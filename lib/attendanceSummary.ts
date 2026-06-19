import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, Student } from "@/lib/types";

const excusedStatuses = new Set<AttendanceStatus>(["excused", "sick", "leave"]);

export type AttendanceSummaryRow = {
  student_id: string;
  student_number: string;
  full_name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  closed_sessions: number;
  counted_sessions: number;
  earned_points: number;
  attendance_average: number | null;
};

export type AttendanceSummaryPayload = {
  section: { id: string; name: string };
  subject: { id: string; name: string };
  from: string;
  to: string;
  closed_sessions: number;
  students: number;
  session_dates: string[];
  rows: AttendanceSummaryRow[];
};

export function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function getAttendanceSummary(params: {
  sectionId: string;
  subjectId: string;
  from: string;
  to: string;
}): Promise<AttendanceSummaryPayload> {
  const supabase = getSupabaseAdmin();
  const [{ data: section, error: sectionError }, { data: subject, error: subjectError }] = await Promise.all([
    supabase.from("sections").select("id,name").eq("id", params.sectionId).eq("is_active", true).single(),
    supabase.from("subjects").select("id,name,section_id").eq("id", params.subjectId).eq("is_active", true).single()
  ]);

  if (sectionError || !section) throw new Error("Section was not found.");
  if (subjectError || !subject || subject.section_id !== section.id) throw new Error("Subject was not found in the selected section.");

  const [{ data: links, error: linksError }, { data: sessionsData, error: sessionsError }] = await Promise.all([
    supabase.from("subject_students").select("student_id").eq("subject_id", subject.id),
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("subject_id", subject.id)
      .eq("section_id", section.id)
      .gte("session_date", params.from)
      .lte("session_date", params.to)
      .lt("close_time", new Date().toISOString())
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })
  ]);

  if (linksError) throw new Error(linksError.message);
  if (sessionsError) throw new Error(sessionsError.message);

  const studentIds = (links || []).map((link) => link.student_id);
  let students: Student[] = [];
  if (studentIds.length) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .in("id", studentIds)
      .eq("is_active", true)
      .order("full_name");
    if (error) throw new Error(error.message);
    students = (data || []) as Student[];
  }

  const sessions = (sessionsData || []) as AttendanceSession[];
  let records: AttendanceRecord[] = [];
  if (sessions.length) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("*")
      .in(
        "session_id",
        sessions.map((session) => session.id)
      );
    if (error) throw new Error(error.message);
    records = (data || []) as AttendanceRecord[];
  }

  const recordBySessionAndStudent = new Map(records.map((record) => [`${record.session_id}:${record.student_id}`, record]));
  const rows = students.map((student): AttendanceSummaryRow => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    for (const session of sessions) {
      const status = recordBySessionAndStudent.get(`${session.id}:${student.id}`)?.status || "absent";
      if (status === "on_time") present += 1;
      else if (status === "late") late += 1;
      else if (excusedStatuses.has(status)) excused += 1;
      else absent += 1;
    }

    const countedSessions = sessions.length;
    const earnedPoints = present + late * 0.5;

    return {
      student_id: student.id,
      student_number: student.student_number,
      full_name: student.full_name,
      present,
      late,
      absent,
      excused,
      closed_sessions: sessions.length,
      counted_sessions: countedSessions,
      earned_points: earnedPoints,
      attendance_average: countedSessions ? earnedPoints / countedSessions : null
    };
  });

  return {
    section: { id: section.id, name: section.name },
    subject: { id: subject.id, name: subject.name },
    from: params.from,
    to: params.to,
    closed_sessions: sessions.length,
    students: students.length,
    session_dates: sessions.map((session) => session.session_date),
    rows
  };
}
