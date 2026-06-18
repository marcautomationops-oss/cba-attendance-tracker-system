import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { signedStorageUrl } from "@/lib/storage";
import { finalizeClosedSessionAbsences } from "@/lib/finalizeAttendance";
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, DashboardRecord, Student } from "@/lib/types";

export type SessionRecordsPayload = {
  session: AttendanceSession;
  records: DashboardRecord[];
  counts: Record<AttendanceStatus | "repeatedLate" | "repeatedAbsent", number>;
  totalStudents: number;
};

export async function getSessionRecords(sessionId: string): Promise<SessionRecordsPayload> {
  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error(sessionError?.message || "Session was not found.");

  let students: Student[] = [];
  const typedSession = session as AttendanceSession;
  const attendanceClosed = Date.now() > new Date(typedSession.close_time).getTime();

  if (typedSession.subject_id) {
    const { data: links } = await supabase
      .from("subject_students")
      .select("student_id")
      .eq("subject_id", typedSession.subject_id);

    if (links?.length) {
      const { data: subjectStudents, error: subjectStudentsError } = await supabase
        .from("students")
        .select("*")
        .in(
          "id",
          links.map((link) => link.student_id)
        )
        .eq("is_active", true)
        .order("full_name");

      if (subjectStudentsError) throw new Error(subjectStudentsError.message);
      students = (subjectStudents || []) as Student[];
    }
  }

  if (!students.length) {
    let studentsQuery = supabase.from("students").select("*").eq("is_active", true).order("full_name");
    if (typedSession.section) studentsQuery = studentsQuery.eq("section", typedSession.section);
    const { data, error } = await studentsQuery;
    if (error) throw new Error(error.message);
    students = (data || []) as Student[];
  }

  if (attendanceClosed) {
    await finalizeClosedSessionAbsences(typedSession, { sendSmsAlerts: true });
  }

  const { data: records, error: recordsError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("session_id", sessionId);

  if (recordsError) throw new Error(recordsError.message);

  const historyResult = typedSession.subject_id
    ? await supabase
        .from("attendance_records")
        .select("student_id,status,attendance_sessions!inner(subject_id)")
        .eq("attendance_sessions.subject_id", typedSession.subject_id)
    : await supabase.from("attendance_records").select("student_id,status");

  const { data: historyRows, error: historyError } = historyResult;
  if (historyError) throw new Error(historyError.message);

  const lateCountByStudent = new Map<string, number>();
  const absentCountByStudent = new Map<string, number>();

  for (const row of (historyRows || []) as unknown as Pick<AttendanceRecord, "student_id" | "status">[]) {
    if (row.status === "late") lateCountByStudent.set(row.student_id, (lateCountByStudent.get(row.student_id) || 0) + 1);
    if (row.status === "absent") absentCountByStudent.set(row.student_id, (absentCountByStudent.get(row.student_id) || 0) + 1);
  }

  const recordByStudent = new Map<string, AttendanceRecord>(
    ((records || []) as AttendanceRecord[]).map((record) => [record.student_id, record])
  );

  const dashboardRows: DashboardRecord[] = await Promise.all(
    students.map(async (student) => {
      const record = recordByStudent.get(student.id);
      const lateCount = lateCountByStudent.get(student.id) || 0;
      const absentCount = absentCountByStudent.get(student.id) || 0;

      return {
        record_id: record?.id || null,
        student_id: student.id,
        student_number: student.student_number,
        full_name: student.full_name,
        section: student.section,
        contact_number: student.contact_number,
        profile_photo_path: student.profile_photo_path,
        profile_photo_url: await signedStorageUrl(student.profile_photo_path),
        submitted_at: record?.submitted_at || null,
        status: record?.status || "absent",
        photo_path: record?.photo_path || null,
        photo_deleted_at: record?.photo_deleted_at || null,
        photo_url: record?.photo_deleted_at ? null : await signedStorageUrl(record?.photo_path || null),
        notes: record?.notes || (record?.photo_deleted_at ? "Proof photo deleted after retention period" : null),
        manual_override: record?.manual_override || false,
        late_count: lateCount,
        absent_count: absentCount,
        repeated_late: lateCount >= 3,
        attendance_closed: attendanceClosed
      };
    })
  );

  const counts = dashboardRows.reduce(
    (acc, row) => {
      if (!row.record_id && !attendanceClosed) return acc;
      acc[row.status] += 1;
      if (row.repeated_late) acc.repeatedLate += 1;
      if ((row.absent_count || 0) >= 2) acc.repeatedAbsent += 1;
      return acc;
    },
    { on_time: 0, late: 0, absent: 0, sick: 0, leave: 0, excused: 0, repeatedLate: 0, repeatedAbsent: 0 } as Record<
      AttendanceStatus | "repeatedLate" | "repeatedAbsent",
      number
    >
  );

  return {
    session: typedSession,
    records: dashboardRows,
    counts,
    totalStudents: dashboardRows.length
  };
}
