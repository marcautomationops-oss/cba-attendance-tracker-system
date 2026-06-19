import { NextResponse } from "next/server";
import { attendanceLink } from "@/lib/attendance";
import { jsonError, parseJson, requireTeacher } from "@/lib/api";
import { finalizeClosedSessionAbsences } from "@/lib/finalizeAttendance";
import { ATTENDANCE_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AttendanceSession } from "@/lib/types";

type Context = {
  params: Promise<{ id: string }>;
};

type SessionBody = {
  action?: "close";
};

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("attendance_sessions").select("*").eq("id", id).single();

  if (error) return jsonError(error.message, 404);
  return NextResponse.json({ session: data, attendanceLink: attendanceLink(data.session_token) });
}

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const body = await parseJson<SessionBody>(request);
  if (body?.action !== "close") return jsonError("A valid session action is required.");

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data: existing, error: sessionError } = await supabase.from("attendance_sessions").select("*").eq("id", id).single();
  if (sessionError || !existing) return jsonError("Session was not found.", 404);

  try {
    let session = existing as AttendanceSession;

    if (Date.now() <= new Date(session.close_time).getTime()) {
      const closedAt = new Date().toISOString();
      const cutoffTime = new Date(session.cutoff_time).getTime() > new Date(closedAt).getTime() ? closedAt : session.cutoff_time;
      const { data: closed, error: closeError } = await supabase
        .from("attendance_sessions")
        .update({ close_time: closedAt, cutoff_time: cutoffTime })
        .eq("id", id)
        .select("*")
        .single();

      if (closeError || !closed) throw new Error(closeError?.message || "Attendance could not be closed.");
      session = closed as AttendanceSession;
    }

    const savedAbsences = await finalizeClosedSessionAbsences(session, { sendSmsAlerts: true });
    return NextResponse.json({ session, closed: true, savedAbsences: savedAbsences.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Attendance could not be closed.", 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: session, error: sessionError } = await supabase.from("attendance_sessions").select("id").eq("id", id).single();
  if (sessionError || !session) return jsonError("Session was not found.", 404);

  const { data: records, error: recordsError } = await supabase.from("attendance_records").select("photo_path").eq("session_id", id);
  if (recordsError) return jsonError(recordsError.message, 500);

  const proofPaths = Array.from(new Set((records || []).map((record) => record.photo_path).filter(Boolean) as string[]));
  if (proofPaths.length) {
    const { error: storageError } = await supabase.storage.from(ATTENDANCE_BUCKET).remove(proofPaths);
    if (storageError) return jsonError(storageError.message, 500);
  }

  const { error: deleteError } = await supabase.from("attendance_sessions").delete().eq("id", id);
  if (deleteError) return jsonError(deleteError.message, 500);

  return NextResponse.json({ deleted: true, deletedRecords: records?.length || 0, deletedProofPhotos: proofPaths.length });
}
