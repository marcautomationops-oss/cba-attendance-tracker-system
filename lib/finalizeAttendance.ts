import { checkSmsAlertAfterAttendance } from "@/lib/sms";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AttendanceRecord, AttendanceSession, Student } from "@/lib/types";

async function studentsForSession(session: AttendanceSession) {
  const supabase = getSupabaseAdmin();
  let students: Student[] = [];

  if (session.subject_id) {
    const { data: links, error: linksError } = await supabase.from("subject_students").select("student_id").eq("subject_id", session.subject_id);
    if (linksError) throw new Error(linksError.message);

    if (links?.length) {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .in(
          "id",
          links.map((link) => link.student_id)
        )
        .eq("is_active", true)
        .order("full_name");
      if (error) throw new Error(error.message);
      students = (data || []) as Student[];
    }
  } else {
    let query = supabase.from("students").select("*").eq("is_active", true).order("full_name");
    if (session.section) query = query.eq("section", session.section);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    students = (data || []) as Student[];
  }

  return students;
}

export async function finalizeClosedSessionAbsences(session: AttendanceSession, options: { sendSmsAlerts?: boolean } = {}) {
  if (Date.now() <= new Date(session.close_time).getTime()) return [];

  const supabase = getSupabaseAdmin();
  const students = await studentsForSession(session);
  if (!students.length) return [];

  const { data: existingRecords, error: recordsError } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("session_id", session.id);
  if (recordsError) throw new Error(recordsError.message);

  const existingStudentIds = new Set((existingRecords || []).map((record) => record.student_id));
  const missingStudents = students.filter((student) => !existingStudentIds.has(student.id));
  if (!missingStudents.length) return [];

  const now = new Date().toISOString();
  const rows = missingStudents.map((student) => ({
    session_id: session.id,
    student_id: student.id,
    submitted_at: null,
    status: "absent",
    notes: "Auto-marked absent after session closed",
    manual_override: false,
    updated_at: now
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("attendance_records")
    .upsert(rows, { onConflict: "session_id,student_id", ignoreDuplicates: true })
    .select("*");
  if (insertError) throw new Error(insertError.message);

  const insertedRecords = (inserted || []) as AttendanceRecord[];
  if (options.sendSmsAlerts) {
    const studentById = new Map(students.map((student) => [student.id, student]));
    await Promise.all(
      insertedRecords.map(async (record) => {
        const student = studentById.get(record.student_id);
        if (student) await checkSmsAlertAfterAttendance({ session, student, status: "absent" });
      })
    );
  }

  return insertedRecords;
}

export async function finalizeClosedSessionsAbsences(sessions: AttendanceSession[], options: { sendSmsAlerts?: boolean } = {}) {
  const closed = sessions.filter((session) => Date.now() > new Date(session.close_time).getTime());
  for (const session of closed) {
    await finalizeClosedSessionAbsences(session, options);
  }
}
