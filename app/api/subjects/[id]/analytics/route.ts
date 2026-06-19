import { NextResponse } from "next/server";
import { jsonError, requireTeacher } from "@/lib/api";
import { finalizeClosedSessionsAbsences } from "@/lib/finalizeAttendance";
import { defaultAbsentMilestones, defaultLateMilestones, normalizeMilestones } from "@/lib/sms";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { AppSettings, AttendanceRecord, AttendanceSession, AttendanceStatus, Student, SubjectAlertSettings } from "@/lib/types";

type Context = {
  params: Promise<{ id: string }>;
};

type Risk = "Good" | "Watch" | "At Risk" | "Critical";
type Trend = "Improving" | "Stable" | "Getting Worse" | "No Recent Attendance";
type Action = "No Action" | "Monitor" | "Send SMS" | "Follow Up";

function dayKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function recordTime(record: AttendanceRecord) {
  return record.submitted_at ? new Date(record.submitted_at).getTime() : 0;
}

function actionForRisk(risk: Risk): { action: Action; action_sentence: string } {
  if (risk === "Critical") return { action: "Follow Up", action_sentence: "Talk to the student directly." };
  if (risk === "At Risk") return { action: "Send SMS", action_sentence: "Send a warning message." };
  if (risk === "Watch") return { action: "Monitor", action_sentence: "Watch this student next session." };
  return { action: "No Action", action_sentence: "Student is doing fine." };
}

function riskForStudent(attendancePercentage: number, absent: number, late: number, hasClosedSessions: boolean): Risk {
  if (!hasClosedSessions) return "Good";
  if (attendancePercentage < 50 || absent >= 3) return "Critical";
  if (attendancePercentage < 75 || absent >= 2 || late >= 4) return "At Risk";
  if (attendancePercentage < 90 || late >= 2 || absent >= 1) return "Watch";
  return "Good";
}

function trendForStudent(closedSessions: AttendanceSession[], recordBySession: Map<string, AttendanceRecord>): Trend {
  if (!closedSessions.length || recordBySession.size === 0) return "No Recent Attendance";

  const midpoint = Math.floor(closedSessions.length / 2);
  const older = closedSessions.slice(0, midpoint);
  const recent = closedSessions.slice(midpoint);
  if (!older.length || !recent.length) return "Stable";

  function percentFor(sessions: AttendanceSession[]) {
    const attended = sessions.filter((session) => {
      const record = recordBySession.get(session.id);
      return record && ["on_time", "late", "excused", "sick", "leave"].includes(record.status);
    }).length;
    return Math.round((attended / sessions.length) * 100);
  }

  const change = percentFor(recent) - percentFor(older);
  if (change >= 10) return "Improving";
  if (change <= -10) return "Getting Worse";
  return "Stable";
}

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const [subjectResult, linksResult, sessionsResult, alertsResult, subjectSettingsResult, appSettingsResult] = await Promise.all([
    supabase.from("subjects").select("id,name,section_id").eq("id", id).single(),
    supabase.from("subject_students").select("student_id").eq("subject_id", id),
    supabase.from("attendance_sessions").select("*").eq("subject_id", id).order("start_time", { ascending: false }),
    supabase.from("sms_alerts").select("*").eq("subject_id", id).order("created_at", { ascending: false }),
    supabase.from("subject_alert_settings").select("*").eq("subject_id", id).maybeSingle(),
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
  ]);

  const { data: subject, error: subjectError } = subjectResult;
  if (subjectError) return jsonError(subjectError.message, 500);
  if (!subject) return jsonError("Subject was not found.", 404);
  if (linksResult.error) return jsonError(linksResult.error.message, 500);
  if (sessionsResult.error) return jsonError(sessionsResult.error.message, 500);
  if (alertsResult.error) return jsonError(alertsResult.error.message, 500);

  const links = linksResult.data;
  const sessions = sessionsResult.data;
  const alerts = alertsResult.data;
  const subjectSettings = subjectSettingsResult.data as SubjectAlertSettings | null;
  const appSettings = appSettingsResult.data as AppSettings | null;
  const lateMilestones = normalizeMilestones(subjectSettings?.late_milestones, [appSettings?.default_late_limit || defaultLateMilestones[0], ...defaultLateMilestones]);
  const absentMilestones = normalizeMilestones(subjectSettings?.absent_milestones, [appSettings?.default_absent_limit || defaultAbsentMilestones[0], ...defaultAbsentMilestones]);
  const alertPeriodStart = new Date(subjectSettings?.alert_period_start || 0).getTime();

  const studentIds = (links || []).map((link) => link.student_id);
  let students: Student[] = [];
  if (studentIds.length) {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .in("id", studentIds)
      .eq("is_active", true)
      .order("full_name");
    if (error) return jsonError(error.message, 500);
    students = (data || []) as Student[];
  }

  const typedSessions = (sessions || []) as AttendanceSession[];
  const nowMs = Date.now();
  const closedSessions = typedSessions
    .filter((session) => new Date(session.close_time).getTime() < nowMs)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  await finalizeClosedSessionsAbsences(closedSessions, { sendSmsAlerts: true });
  const closedSessionIds = new Set(closedSessions.map((session) => session.id));
  const sessionById = new Map(typedSessions.map((session) => [session.id, session]));
  const sessionIds = typedSessions.map((session) => session.id);
  let records: AttendanceRecord[] = [];
  if (sessionIds.length) {
    const { data, error } = await supabase.from("attendance_records").select("*").in("session_id", sessionIds);
    if (error) return jsonError(error.message, 500);
    records = (data || []) as AttendanceRecord[];
  }

  const today = dayKey(new Date().toISOString());
  const todaySessionIds = new Set(typedSessions.filter((session) => dayKey(session.start_time) === today).map((session) => session.id));
  const todayClosedSessionIds = new Set(closedSessions.filter((session) => dayKey(session.start_time) === today).map((session) => session.id));
  const todayRecords = records.filter((record) => todaySessionIds.has(record.session_id));
  const todayPresent = todayRecords.filter((record) => record.status === "on_time").length;
  const todayLate = todayRecords.filter((record) => record.status === "late").length;
  const todayExplicitAbsent = todayRecords.filter((record) => record.status === "absent").length;
  const todaySubmittedByClosedSession = new Set(todayRecords.filter((record) => todayClosedSessionIds.has(record.session_id)).map((record) => `${record.session_id}:${record.student_id}`));
  const todayAbsent =
    todayExplicitAbsent +
    (todayClosedSessionIds.size > 0
      ? students.reduce(
          (count, student) =>
            count + Array.from(todayClosedSessionIds).filter((sessionId) => !todaySubmittedByClosedSession.has(`${sessionId}:${student.id}`)).length,
          0
        )
      : 0);

  const closedRecords = records.filter((record) => closedSessionIds.has(record.session_id));
  const recordsByStudent = new Map<string, AttendanceRecord[]>();
  for (const record of closedRecords) {
    const list = recordsByStudent.get(record.student_id) || [];
    list.push(record);
    recordsByStudent.set(record.student_id, list);
  }

  const alertStatusByMilestone = new Map<string, string>();
  for (const alert of alerts || []) {
    alertStatusByMilestone.set(`${alert.student_id}:${alert.trigger_type}:${alert.threshold}`, alert.sent_at ? "Sent" : "Failed");
  }

  const recordsByClosedSession = new Map<string, AttendanceRecord[]>();
  for (const record of records.filter((record) => closedSessionIds.has(record.session_id))) {
    const list = recordsByClosedSession.get(record.session_id) || [];
    list.push(record);
    recordsByClosedSession.set(record.session_id, list);
  }

  const attendance_over_time = closedSessions.slice(-8).map((session) => {
    const sessionRecords = recordsByClosedSession.get(session.id) || [];
    const submittedIds = new Set(sessionRecords.map((record) => record.student_id));
    const on_time = sessionRecords.filter((record) => record.status === "on_time").length;
    const late = sessionRecords.filter((record) => record.status === "late").length;
    const explicitAbsent = sessionRecords.filter((record) => record.status === "absent").length;
    const absent = explicitAbsent + students.filter((student) => !submittedIds.has(student.id)).length;
    const excused = sessionRecords.filter((record) => ["excused", "sick", "leave"].includes(record.status)).length;

    return {
      session_id: session.id,
      start_time: session.start_time,
      on_time,
      late,
      absent,
      excused,
      total: Math.max(students.length, on_time + late + absent + excused)
    };
  });

  const individual = students.map((student) => {
    const list = (recordsByStudent.get(student.id) || []).sort((a, b) => recordTime(b) - recordTime(a));
    const recordBySession = new Map(list.map((record) => [record.session_id, record]));
    const onTime = list.filter((record) => record.status === "on_time").length;
    const late = list.filter((record) => record.status === "late").length;
    const explicitAbsent = list.filter((record) => record.status === "absent").length;
    const excused = list.filter((record) => ["excused", "sick", "leave"].includes(record.status)).length;
    const submittedClosedSessionIds = new Set(list.filter((record) => closedSessionIds.has(record.session_id)).map((record) => record.session_id));
    const missingClosed = closedSessions.filter((session) => !submittedClosedSessionIds.has(session.id)).length;
    const absent = explicitAbsent + missingClosed;
    const alertPeriodRecords = list.filter((record) => {
      const session = sessionById.get(record.session_id);
      return session && new Date(session.start_time).getTime() >= alertPeriodStart;
    });
    const alertLate = alertPeriodRecords.filter((record) => record.status === "late").length;
    const alertAbsent = alertPeriodRecords.filter((record) => record.status === "absent").length;
    const attended = onTime + late + excused;
    const attendancePercentage = closedSessions.length ? Math.round((attended / closedSessions.length) * 100) : 0;
    const lastStatus = (list[0]?.status || (typedSessions.length ? "absent" : "absent")) as AttendanceStatus;
    const risk = riskForStudent(attendancePercentage, absent, late, closedSessions.length > 0);
    const action = actionForRisk(risk);
    const smsAlerts = {
      late: alertStatusByMilestone.get(`${student.id}:late:${alertLate}`) || "Not sent",
      absent: alertStatusByMilestone.get(`${student.id}:absent:${alertAbsent}`) || "Not sent"
    };
    const trend = trendForStudent(closedSessions, recordBySession);
    const recent_sessions = closedSessions.slice(-8).reverse().map((session) => {
      const record = recordBySession.get(session.id);
      const status = (record?.status || "absent") as AttendanceStatus;
      return {
        session_id: session.id,
        date: session.start_time,
        status
      };
    });

    return {
      student_id: student.id,
      student_number: student.student_number,
      full_name: student.full_name,
      contact_number: student.contact_number,
      attendance_percentage: attendancePercentage,
      on_time_count: onTime,
      late_count: late,
      absent_count: absent,
      alert_late_count: alertLate,
      alert_absent_count: alertAbsent,
      excused_count: excused,
      last_status: lastStatus,
      sms_alert_status: smsAlerts.late === "Sent" || smsAlerts.absent === "Sent" ? "Sent" : "Not sent",
      sms_alerts: smsAlerts,
      trend,
      risk,
      ...action,
      recent_sessions
    };
  });

  const risk_levels = individual.reduce(
    (acc, student) => {
      acc[student.risk] += 1;
      return acc;
    },
    { Good: 0, Watch: 0, "At Risk": 0, Critical: 0 } as Record<Risk, number>
  );

  const totalPossibleAttendance = closedSessions.length * students.length;
  const totalAttended = individual.reduce((sum, student) => sum + student.on_time_count + student.late_count + student.excused_count, 0);
  const totalLate = individual.reduce((sum, student) => sum + student.late_count, 0);
  const totalAbsent = individual.reduce((sum, student) => sum + student.absent_count, 0);
  const studentsAtRisk = individual.filter((student) => student.risk !== "Good").length;
  const firstLateMilestone = Math.min(...lateMilestones);
  const firstAbsentMilestone = Math.min(...absentMilestones);
  const alertCandidates = individual.filter(
    (student) => student.alert_absent_count >= firstAbsentMilestone || student.alert_late_count >= firstLateMilestone
  );
  const studentsNeedingSms = alertCandidates.filter((student) => {
    if (student.alert_absent_count >= firstAbsentMilestone) return student.sms_alerts.absent !== "Sent";
    return student.sms_alerts.late !== "Sent";
  });
  const leaders = {
    most_present: [...individual]
      .sort((a, b) => b.on_time_count + b.late_count + b.excused_count - (a.on_time_count + a.late_count + a.excused_count))
      .slice(0, 3)
      .map((student) => ({
        student_id: student.student_id,
        full_name: student.full_name,
        value: student.on_time_count + student.late_count + student.excused_count,
        label: `${student.on_time_count + student.late_count + student.excused_count}/${closedSessions.length} sessions`
      })),
    most_late: [...individual]
      .sort((a, b) => b.late_count - a.late_count)
      .slice(0, 3)
      .map((student) => ({
        student_id: student.student_id,
        full_name: student.full_name,
        value: student.late_count,
        label: `${student.late_count} late`
      })),
    most_absent: [...individual]
      .sort((a, b) => b.absent_count - a.absent_count)
      .slice(0, 3)
      .map((student) => ({
        student_id: student.student_id,
        full_name: student.full_name,
        value: student.absent_count,
        label: `${student.absent_count} absent`
      }))
  };

  return NextResponse.json({
    today: {
      present: todayPresent,
      late: todayLate,
      absent: todayAbsent
    },
    summary: {
      class_attendance: totalPossibleAttendance ? Math.round((totalAttended / totalPossibleAttendance) * 100) : 0,
      total_sessions: closedSessions.length,
      students_at_risk: studentsAtRisk,
      late_count: totalLate,
      absent_count: totalAbsent,
      sms_alerts: studentsNeedingSms.length,
      sms_reachable: studentsNeedingSms.filter((student) => Boolean(student.contact_number)).length
    },
    attendance_over_time,
    risk_levels,
    leaders,
    individual,
    needs_attention: alertCandidates
  });
}
