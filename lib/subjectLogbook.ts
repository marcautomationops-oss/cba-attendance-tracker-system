import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, Student } from "@/lib/types";

const excusedStatuses = new Set<AttendanceStatus>(["excused", "sick", "leave"]);

export type LogbookSession = Pick<AttendanceSession, "id" | "session_date" | "start_time" | "close_time">;

export type LogbookRow = {
  student_id: string;
  student_number: string;
  full_name: string;
  statuses: Record<string, AttendanceStatus>;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendance_average: number | null;
};

export type SubjectLogbookPayload = {
  subject: { id: string; name: string; section_id: string };
  from: string;
  to: string;
  sessions: LogbookSession[];
  rows: LogbookRow[];
};

export async function getSubjectLogbook(subjectId: string, from: string, to: string): Promise<SubjectLogbookPayload> {
  const supabase = getSupabaseAdmin();
  const [{ data: subject, error: subjectError }, { data: links, error: linksError }, { data: sessionRows, error: sessionsError }] = await Promise.all([
    supabase.from("subjects").select("id,name,section_id").eq("id", subjectId).eq("is_active", true).single(),
    supabase.from("subject_students").select("student_id").eq("subject_id", subjectId),
    supabase
      .from("attendance_sessions")
      .select("id,session_date,start_time,close_time")
      .eq("subject_id", subjectId)
      .gte("session_date", from)
      .lte("session_date", to)
      .lt("close_time", new Date().toISOString())
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })
  ]);

  if (subjectError || !subject) throw new Error("Subject was not found.");
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

  const sessions = (sessionRows || []) as LogbookSession[];
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

  const recordByCell = new Map(records.map((record) => [`${record.session_id}:${record.student_id}`, record]));
  const rows = students.map((student): LogbookRow => {
    const statuses: Record<string, AttendanceStatus> = {};
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    for (const session of sessions) {
      const status = recordByCell.get(`${session.id}:${student.id}`)?.status || "absent";
      statuses[session.id] = status;
      if (status === "on_time") present += 1;
      else if (status === "late") late += 1;
      else if (excusedStatuses.has(status)) excused += 1;
      else absent += 1;
    }

    return {
      student_id: student.id,
      student_number: student.student_number,
      full_name: student.full_name,
      statuses,
      present,
      late,
      absent,
      excused,
      attendance_average: sessions.length ? (present + late * 0.5) / sessions.length : null
    };
  });

  return {
    subject: { id: subject.id, name: subject.name, section_id: subject.section_id },
    from,
    to,
    sessions,
    rows
  };
}
