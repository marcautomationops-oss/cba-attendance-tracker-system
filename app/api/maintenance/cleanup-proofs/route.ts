import { NextResponse } from "next/server";
import { jsonError, requireTeacher } from "@/lib/api";
import { ATTENDANCE_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function cleanupProofs() {
  const supabase = getSupabaseAdmin();
  const { data: settings } = await supabase.from("app_settings").select("proof_retention_days").eq("id", 1).maybeSingle();
  const retentionDays = Number(settings?.proof_retention_days || 180);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: records, error } = await supabase
    .from("attendance_records")
    .select("id,photo_path")
    .not("photo_path", "is", null)
    .is("photo_deleted_at", null)
    .lt("submitted_at", cutoff);

  if (error) return jsonError(error.message, 500);

  const paths = (records || []).map((record) => record.photo_path).filter(Boolean);
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(ATTENDANCE_BUCKET).remove(paths);
    if (removeError) return jsonError(removeError.message, 500);
    const { error: updateError } = await supabase
      .from("attendance_records")
      .update({ photo_path: null, photo_deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in(
        "id",
        (records || []).map((record) => record.id)
      );
    if (updateError) return jsonError(updateError.message, 500);
  }

  return NextResponse.json({ deleted: paths.length, retentionDays });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonError("Maintenance authorization required.", 401);
  }
  return cleanupProofs();
}

export async function POST(request: Request) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);
  return cleanupProofs();
}
