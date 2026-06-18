import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AttendanceStatus, AppSettings, AttendanceSession, Student, SubjectAlertSettings } from "@/lib/types";

type SmsResult = {
  sent: boolean;
  providerStatus: string;
};

export const defaultLateTemplate =
  "Hello {student}, you have reached {late_count} late record(s) in {subject}. Please attend class on time.";

export const defaultAbsentTemplate =
  "Hello {student}, you have reached {absent_count} absence(s) in {subject}. Please check with your teacher.";

export async function sendSemaphoreSms(params: {
  apiKey: string;
  senderName?: string | null;
  phoneNumber: string;
  message: string;
}): Promise<SmsResult> {
  const body = new URLSearchParams({
    apikey: params.apiKey,
    number: params.phoneNumber,
    message: params.message
  });

  if (params.senderName) body.set("sendername", params.senderName);

  const response = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await response.text();
  return {
    sent: response.ok,
    providerStatus: text.slice(0, 900)
  };
}

export function getSemaphoreConfig() {
  return {
    apiKey: process.env.SEMAPHORE_API_KEY || "",
    senderName: process.env.SEMAPHORE_SENDER_NAME || null
  };
}

export function renderAlertMessage(params: {
  template: string | null | undefined;
  triggerType: "late" | "absent";
  subjectName: string;
  studentName: string;
  lateCount: number;
  absentCount: number;
}) {
  const fallback = params.triggerType === "late" ? defaultLateTemplate : defaultAbsentTemplate;
  return (params.template || fallback)
    .replaceAll("{student}", params.studentName)
    .replaceAll("{subject}", params.subjectName)
    .replaceAll("{late_count}", String(params.lateCount))
    .replaceAll("{absent_count}", String(params.absentCount));
}

export async function checkSmsAlertAfterAttendance(params: {
  session: AttendanceSession;
  student: Student;
  status: AttendanceStatus;
}) {
  if (!params.session.subject_id || !["late", "absent"].includes(params.status)) return;

  const supabase = getSupabaseAdmin();
  const { data: appSettings } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const settings = appSettings as AppSettings | null;

  const { data: subjectSettings } = await supabase
    .from("subject_alert_settings")
    .select("*")
    .eq("subject_id", params.session.subject_id)
    .maybeSingle();

  const alertSettings = subjectSettings as SubjectAlertSettings | null;
  const automatic = alertSettings?.automatic_sms ?? settings?.default_automatic_sms ?? false;
  if (!automatic) return;

  const semaphore = getSemaphoreConfig();
  const apiKey = semaphore.apiKey;
  if (!apiKey || !params.student.contact_number) return;

  const periodStart = alertSettings?.alert_period_start || new Date(0).toISOString();
  const triggerType = params.status as "late" | "absent";
  const threshold =
    triggerType === "late"
      ? alertSettings?.late_limit ?? settings?.default_late_limit ?? 3
      : alertSettings?.absent_limit ?? settings?.default_absent_limit ?? 2;

  const { data: countRows, error: countError } = await supabase
    .from("attendance_records")
    .select("id, attendance_sessions!inner(subject_id)")
    .eq("student_id", params.student.id)
    .eq("status", triggerType)
    .eq("attendance_sessions.subject_id", params.session.subject_id)
    .gte("submitted_at", periodStart);

  if (countError || (countRows?.length || 0) < threshold) return;
  const triggerCount = countRows?.length || 0;

  const { data: existing } = await supabase
    .from("sms_alerts")
    .select("id")
    .eq("student_id", params.student.id)
    .eq("subject_id", params.session.subject_id)
    .eq("trigger_type", triggerType)
    .eq("alert_period_start", periodStart)
    .maybeSingle();

  if (existing) return;

  const message = renderAlertMessage({
    template: triggerType === "late" ? alertSettings?.late_template : alertSettings?.absent_template,
    triggerType,
    subjectName: params.session.subject || params.session.class_name,
    studentName: params.student.full_name,
    lateCount: triggerType === "late" ? triggerCount : 0,
    absentCount: triggerType === "absent" ? triggerCount : 0
  });
  const result = await sendSemaphoreSms({
    apiKey,
    senderName: semaphore.senderName,
    phoneNumber: params.student.contact_number,
    message
  });

  await supabase.from("sms_alerts").insert({
    student_id: params.student.id,
    subject_id: params.session.subject_id,
    trigger_type: triggerType,
    threshold,
    phone_number: params.student.contact_number,
    message,
    sent_at: result.sent ? new Date().toISOString() : null,
    provider_status: result.providerStatus,
    alert_period_start: periodStart
  });
}
