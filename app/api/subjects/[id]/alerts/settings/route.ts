import { NextResponse } from "next/server";
import { jsonError, parseJson, requireTeacher } from "@/lib/api";
import { defaultAbsentTemplate, defaultLateTemplate } from "@/lib/sms";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string }>;
};

type Body = {
  automatic_sms?: boolean;
  late_limit?: number;
  absent_limit?: number;
  late_template?: string;
  absent_template?: string;
  reset_period?: boolean;
};

async function defaults() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return {
    automatic_sms: Boolean(data?.default_automatic_sms),
    late_limit: Number(data?.default_late_limit || 3),
    absent_limit: Number(data?.default_absent_limit || 2),
    late_template: defaultLateTemplate,
    absent_template: defaultAbsentTemplate
  };
}

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const base = await defaults();

  const { data, error } = await supabase.from("subject_alert_settings").select("*").eq("subject_id", id).maybeSingle();
  if (error) {
    if (error.message.includes("subject_alert_settings") || error.message.includes("schema cache")) {
      return NextResponse.json({
        settings: {
          subject_id: id,
          ...base,
          alert_period_start: new Date().toISOString(),
          schema_missing: true
        }
      });
    }
    return jsonError(error.message, 500);
  }

  return NextResponse.json({
    settings:
      data
        ? {
            ...data,
            late_template: data.late_template || base.late_template,
            absent_template: data.absent_template || base.absent_template
          }
        : {
            subject_id: id,
            ...base,
            alert_period_start: new Date().toISOString()
          }
  });
}

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const body = await parseJson<Body>(request);
  if (!body) return jsonError("Alert settings payload is required.");

  const supabase = getSupabaseAdmin();
  const base = await defaults();
  const { data: existing, error: existingError } = await supabase.from("subject_alert_settings").select("*").eq("subject_id", id).maybeSingle();
  if (existingError && (existingError.message.includes("subject_alert_settings") || existingError.message.includes("schema cache"))) {
    return jsonError("Run the updated supabase/schema.sql before saving subject alert settings.", 500);
  }

  const row = {
    subject_id: id,
    automatic_sms: body.automatic_sms ?? existing?.automatic_sms ?? base.automatic_sms,
    late_limit: Number(body.late_limit || existing?.late_limit || base.late_limit),
    absent_limit: Number(body.absent_limit || existing?.absent_limit || base.absent_limit),
    late_template: body.late_template ?? existing?.late_template ?? base.late_template,
    absent_template: body.absent_template ?? existing?.absent_template ?? base.absent_template,
    alert_period_start: body.reset_period ? new Date().toISOString() : existing?.alert_period_start || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from("subject_alert_settings").upsert(row, { onConflict: "subject_id" }).select("*").single();
  if (error) {
    if (error.message.includes("late_template") || error.message.includes("absent_template") || error.message.includes("schema cache")) {
      return jsonError("Run the updated supabase/schema.sql before saving SMS templates.", 500);
    }
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ settings: data });
}
