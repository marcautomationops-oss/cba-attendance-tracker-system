import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { isDateOnly } from "@/lib/attendanceSummary";
import { getSubjectLogbook } from "@/lib/subjectLogbook";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AttendanceStatus } from "@/lib/types";

type Context = {
  params: Promise<{ id: string }>;
};

type Change = {
  session_id?: string;
  student_id?: string;
  status?: AttendanceStatus;
};

type SaveBody = {
  changes?: Change[];
};

const allowedStatuses: AttendanceStatus[] = ["on_time", "late", "absent", "excused"];

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!isDateOnly(from) || !isDateOnly(to)) return jsonError("Start and end dates are required.");
  if (from > to) return jsonError("Start date must be before the end date.");

  try {
    return NextResponse.json(await getSubjectLogbook(id, from, to));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Logbook could not load.", 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const body = await parseJson<SaveBody>(request);
  const changes = body?.changes;
  if (!changes?.length) return jsonError("Add at least one attendance change.");
  if (changes.length > 5000) return jsonError("Too many changes in one save.");

  const normalized = changes.map((change) => ({
    session_id: cleanText(change.session_id),
    student_id: cleanText(change.student_id),
    status: change.status
  }));
  if (normalized.some((change) => !change.session_id || !change.student_id || !change.status || !allowedStatuses.includes(change.status))) {
    return jsonError("Every change must include a valid session, student, and status.");
  }

  const keys = normalized.map((change) => `${change.session_id}:${change.student_id}`);
  if (new Set(keys).size !== keys.length) return jsonError("A logbook cell can only be changed once per save.");

  const sessionIds = Array.from(new Set(normalized.map((change) => change.session_id)));
  const studentIds = Array.from(new Set(normalized.map((change) => change.student_id)));
  const supabase = getSupabaseAdmin();
  const [{ data: sessions, error: sessionsError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("attendance_sessions").select("id,close_time").eq("subject_id", id).in("id", sessionIds),
    supabase.from("subject_students").select("student_id").eq("subject_id", id).in("student_id", studentIds)
  ]);
  if (sessionsError) return jsonError(sessionsError.message, 500);
  if (linksError) return jsonError(linksError.message, 500);

  const validSessions = new Map((sessions || []).map((session) => [session.id, session]));
  const validStudents = new Set((links || []).map((link) => link.student_id));
  if (sessionIds.some((sessionId) => !validSessions.has(sessionId))) return jsonError("One or more sessions do not belong to this subject.");
  if (studentIds.some((studentId) => !validStudents.has(studentId))) return jsonError("One or more students are not enrolled in this subject.");
  if (Array.from(validSessions.values()).some((session) => Date.now() <= new Date(session.close_time).getTime())) {
    return jsonError("Open attendance sessions cannot be edited from the Logbook.");
  }

  const { data: existingRecords, error: existingError } = await supabase
    .from("attendance_records")
    .select("session_id,student_id,submitted_at,notes")
    .in("session_id", sessionIds)
    .in("student_id", studentIds);
  if (existingError) return jsonError(existingError.message, 500);
  const existingByCell = new Map((existingRecords || []).map((record) => [`${record.session_id}:${record.student_id}`, record]));

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("attendance_records")
    .upsert(
      normalized.map((change) => {
        const existing = existingByCell.get(`${change.session_id}:${change.student_id}`);
        return {
          session_id: change.session_id,
          student_id: change.student_id,
          status: change.status,
          submitted_at: existing ? existing.submitted_at : null,
          notes: existing ? existing.notes : "Updated from Logbook",
          manual_override: true,
          updated_at: now
        };
      }),
      { onConflict: "session_id,student_id" }
    )
    .select("id");
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ saved: data?.length || normalized.length });
}
