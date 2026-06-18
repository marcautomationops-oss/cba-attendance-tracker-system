import { NextResponse } from "next/server";
import { attendanceLink } from "@/lib/attendance";
import { jsonError, requireTeacher } from "@/lib/api";
import { ATTENDANCE_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string }>;
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
