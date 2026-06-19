import { NextResponse } from "next/server";
import { changeAccessCode } from "@/lib/accessCode";
import { jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SettingsBody = {
  proof_retention_days?: number;
  current_access_code?: string;
  new_access_code?: string;
};

function teacherSettings(data: { proof_retention_days?: number | null }) {
  return { proof_retention_days: Number(data.proof_retention_days || 180) };
}

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const supabase = getSupabaseAdmin();
  await supabase.from("app_settings").upsert({ id: 1 }, { onConflict: "id" });
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ settings: teacherSettings(data) });
}

export async function PATCH(request: Request) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const body = await parseJson<SettingsBody>(request);
  if (!body) return jsonError("Settings payload is required.");

  if (body.new_access_code) {
    try {
      await changeAccessCode(body.current_access_code || "", body.new_access_code);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Access code could not be changed.");
    }
  }

  const supabase = getSupabaseAdmin();
  const retentionDays = Math.min(3650, Math.max(30, Number(body.proof_retention_days || 180)));
  const nextSettings = {
    id: 1,
    proof_retention_days: retentionDays,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from("app_settings").upsert(nextSettings, { onConflict: "id" }).select("*").single();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ settings: teacherSettings(data) });
}
