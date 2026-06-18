import { NextResponse } from "next/server";
import type { AttendanceStatus } from "@/lib/types";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSessionRecords } from "@/lib/sessionRecords";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const allowedStatuses: AttendanceStatus[] = ["on_time", "late", "absent", "sick", "leave", "excused"];

type Context = {
  params: Promise<{ id: string }>;
};

type ManualRecordBody = {
  student_id?: string;
  status?: AttendanceStatus;
  notes?: string | null;
};

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;

  try {
    return NextResponse.json(await getSessionRecords(id));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Attendance records could not load.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<ManualRecordBody>(request);
  const status = body?.status;
  const student_id = cleanText(body?.student_id);

  if (!student_id || !status || !allowedStatuses.includes(status)) {
    return jsonError("Student and valid status are required.");
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error: sessionError } = await supabase.from("attendance_sessions").select("close_time").eq("id", id).single();
  if (sessionError || !session) return jsonError("Session was not found.", 404);

  const submittedAt = Date.now() <= new Date(session.close_time).getTime() ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("attendance_records")
    .upsert(
      {
        session_id: id,
        student_id,
        submitted_at: submittedAt,
        status,
        notes: body?.notes === undefined ? null : cleanText(body.notes) || null,
        manual_override: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: "session_id,student_id" }
    )
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ record: data });
}
