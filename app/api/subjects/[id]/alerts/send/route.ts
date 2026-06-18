import { NextResponse } from "next/server";
import { alertMessage, getSemaphoreConfig, sendSemaphoreSms } from "@/lib/sms";
import { jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AppSettings, SubjectAlertSettings } from "@/lib/types";

type Context = {
  params: Promise<{ id: string }>;
};

type Body = {
  student_id?: string;
  trigger_type?: "late" | "absent";
};

export async function POST(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const body = await parseJson<Body>(request);
  if (!body?.student_id || !body.trigger_type) return jsonError("Student and alert type are required.");

  const supabase = getSupabaseAdmin();
  const [{ data: subject }, { data: student }, { data: settings }, { data: alertSettings }] = await Promise.all([
    supabase.from("subjects").select("name").eq("id", id).single(),
    supabase.from("students").select("*").eq("id", body.student_id).single(),
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("subject_alert_settings").select("*").eq("subject_id", id).maybeSingle()
  ]);

  const appSettings = settings as AppSettings | null;
  const subjectAlerts = alertSettings as SubjectAlertSettings | null;
  const semaphore = getSemaphoreConfig();

  if (!subject || !student) return jsonError("Student or subject was not found.", 404);
  if (!student.contact_number) return jsonError("This student has no contact number.");
  if (!semaphore.apiKey) return jsonError("Set SEMAPHORE_API_KEY in the server environment first.");

  const periodStart = subjectAlerts?.alert_period_start || new Date(0).toISOString();
  const threshold =
    body.trigger_type === "late"
      ? subjectAlerts?.late_limit ?? appSettings?.default_late_limit ?? 3
      : subjectAlerts?.absent_limit ?? appSettings?.default_absent_limit ?? 2;
  const message = alertMessage(subject.name);

  const result = await sendSemaphoreSms({
    apiKey: semaphore.apiKey,
    senderName: semaphore.senderName,
    phoneNumber: student.contact_number,
    message
  });

  const { data: alert, error } = await supabase
    .from("sms_alerts")
    .upsert(
      {
        student_id: student.id,
        subject_id: id,
        trigger_type: body.trigger_type,
        threshold,
        phone_number: student.contact_number,
        message,
        sent_at: result.sent ? new Date().toISOString() : null,
        provider_status: result.providerStatus,
        alert_period_start: periodStart
      },
      { onConflict: "student_id,subject_id,trigger_type,alert_period_start" }
    )
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ alert });
}
