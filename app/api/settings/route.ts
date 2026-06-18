import { NextResponse } from "next/server";
import { jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SettingsBody = {
  default_late_limit?: number;
  default_absent_limit?: number;
  default_automatic_sms?: boolean;
  proof_retention_days?: number;
  storage_warning_mb?: number;
};

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const supabase = getSupabaseAdmin();
  await supabase.from("app_settings").upsert({ id: 1 }, { onConflict: "id" });
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();

  if (error) return jsonError(error.message, 500);
  const { semaphore_api_key, semaphore_sender_name, ...safeSettings } = data;
  void semaphore_api_key;
  void semaphore_sender_name;
  return NextResponse.json({ settings: safeSettings });
}

export async function PATCH(request: Request) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const body = await parseJson<SettingsBody>(request);
  if (!body) return jsonError("Settings payload is required.");

  const supabase = getSupabaseAdmin();
  const nextSettings = {
    id: 1,
    default_late_limit: Number(body.default_late_limit || 3),
    default_absent_limit: Number(body.default_absent_limit || 2),
    default_automatic_sms: Boolean(body.default_automatic_sms),
    proof_retention_days: Number(body.proof_retention_days || 180),
    storage_warning_mb: Number(body.storage_warning_mb || 750),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from("app_settings").upsert(nextSettings, { onConflict: "id" }).select("*").single();
  if (error) return jsonError(error.message, 500);
  const { semaphore_api_key, semaphore_sender_name, ...safeSettings } = data;
  void semaphore_api_key;
  void semaphore_sender_name;
  return NextResponse.json({ settings: safeSettings });
}
