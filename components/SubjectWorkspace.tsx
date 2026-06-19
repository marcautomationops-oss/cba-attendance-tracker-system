"use client";

import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Pencil,
  Play,
  Plus,
  Radio,
  Trash2,
  Upload,
  UserPlus,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ButtonHTMLAttributes, type ComponentType, type FormEvent, type ReactNode } from "react";
import { AttendanceRecordRows } from "@/components/AttendanceRecordRows";
import { LiveAttendancePanel } from "@/components/LiveAttendancePanel";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { SubjectWorkspaceSkeleton } from "@/components/SubjectWorkspaceSkeleton";
import { displayDateTime } from "@/lib/attendance";
import type { AttendanceSession, AttendanceStatus, DashboardRecord, Section, Student, Subject } from "@/lib/types";

type Created = {
  session: AttendanceSession;
  attendanceLink: string;
};

type Tab = "current" | "history" | "analytics" | "alerts";

type ReviewRow = {
  row_number: number;
  student_number: string;
  full_name: string;
  contact_number: string | null;
  issues: string[];
  save: boolean;
};

type PhotoReview = {
  matched: { student_id: string; student_number: string; full_name: string; filename: string; data_url: string }[];
  unmatched: { filename: string }[];
  missing: { student_id: string; student_number: string; full_name: string }[];
};

type SessionSummary = {
  sessionId: string;
  on_time: number;
  late: number;
  absent: number;
  excused: number;
};

type SessionRecords = {
  records: DashboardRecord[];
  counts: Record<AttendanceStatus | "repeatedLate" | "repeatedAbsent", number>;
};

type RiskLevel = "Good" | "Watch" | "At Risk" | "Critical";
type TrendLabel = "Improving" | "Stable" | "Getting Worse" | "No Recent Attendance";
type ActionLabel = "No Action" | "Monitor" | "Send SMS" | "Follow Up";

type RecentSessionAnalytics = {
  session_id: string;
  date: string;
  label: string;
  status: AttendanceStatus;
};

type IndividualAnalytics = {
  student_id: string;
  student_number: string;
  full_name: string;
  contact_number: string | null;
  attendance_percentage: number;
  on_time_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  last_status: AttendanceStatus;
  sms_alert_status: string;
  sms_alerts: {
    late: string;
    absent: string;
  };
  trend: TrendLabel;
  risk: RiskLevel;
  action: ActionLabel;
  action_sentence: string;
  recent_sessions: RecentSessionAnalytics[];
};

type AttendanceTrendRow = {
  session_id: string;
  label: string;
  time_label: string;
  on_time: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
};

type AnalyticsLeader = {
  student_id: string;
  full_name: string;
  value: number;
  label: string;
};

type AnalyticsPayload = {
  today: { present: number; late: number; absent: number };
  summary: {
    class_attendance: number;
    total_sessions: number;
    students_at_risk: number;
    late_count: number;
    absent_count: number;
    sms_alerts: number;
  };
  attendance_over_time: AttendanceTrendRow[];
  risk_levels: Record<RiskLevel, number>;
  leaders: {
    most_present: AnalyticsLeader[];
    most_late: AnalyticsLeader[];
    most_absent: AnalyticsLeader[];
  };
  individual: IndividualAnalytics[];
  needs_attention: IndividualAnalytics[];
};

type AlertSettings = {
  automatic_sms: boolean;
  late_limit: number;
  absent_limit: number;
  late_template: string;
  absent_template: string;
  late_milestones: number[];
  absent_milestones: number[];
  alert_period_start: string;
  schema_missing?: boolean;
};

type AlertTrigger = "late" | "absent";

const tabs: { id: Tab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "current", label: "Current", icon: Radio },
  { id: "history", label: "History", icon: History },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "alerts", label: "Alerts", icon: Bell }
];

const validTabs = new Set<Tab>(["current", "history", "analytics", "alerts"]);

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function compressImageFile(file: File, maxWidth: number, maxHeight: number, quality: number) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image could not be processed.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  return canvas.toDataURL("image/jpeg", quality);
}

function StudentAvatar({ student }: { student: Student }) {
  return student.profile_photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={student.profile_photo_url} alt="" className="h-11 w-11 rounded object-cover ring-1 ring-line" />
  ) : (
    <div className="grid h-11 w-11 place-items-center rounded bg-ink text-sm font-bold text-white">{initials(student.full_name)}</div>
  );
}

function ControlButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded bg-ledger px-4 py-3 text-sm font-bold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function UtilityLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-xs font-bold uppercase tracking-[0.22em] text-pool ${className}`}>{children}</p>;
}

function isSessionOpen(session: AttendanceSession, nowMs: number) {
  return new Date(session.close_time).getTime() >= nowMs;
}

function attendanceLinkFromToken(sessionToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window === "undefined" ? "" : window.location.origin);
  return `${appUrl.replace(/\/$/, "")}/attendance/${sessionToken}`;
}

async function readJson(response: Response, label: string) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { error: response.ok ? `${label} returned an unexpected response.` : `${label} returned ${response.status}.` };
  }
  return response.json();
}

export function SubjectWorkspace({ sectionId, subjectId }: { sectionId: string; subjectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("current");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [created, setCreated] = useState<Created | null>(null);
  const [studentForm, setStudentForm] = useState({ student_number: "", full_name: "", contact_number: "", profile_photo_data_url: "" });
  const [lateAfterMinutes, setLateAfterMinutes] = useState(15);
  const [closeAfterMinutes, setCloseAfterMinutes] = useState(60);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importRows, setImportRows] = useState<ReviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [photoReview, setPhotoReview] = useState<PhotoReview | null>(null);
  const [reviewingPhotos, setReviewingPhotos] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [sessionSummaries, setSessionSummaries] = useState<Record<string, SessionSummary>>({});
  const [selectedSessionRecords, setSelectedSessionRecords] = useState<SessionRecords | null>(null);
  const [loadingSelectedSession, setLoadingSelectedSession] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<AttendanceSession | null>(null);
  const nowMinute = Math.floor(nowMs / 60_000);

  const activeSession = useMemo(() => {
    if (created?.session && isSessionOpen(created.session, nowMs)) return created.session;
    return sessions.find((session) => isSessionOpen(session, nowMs)) || null;
  }, [created, nowMs, sessions]);
  const historySessions = useMemo(() => sessions.filter((session) => !isSessionOpen(session, nowMinute * 60_000)), [nowMinute, sessions]);
  const historySessionKey = useMemo(() => historySessions.map((session) => session.id).join("|"), [historySessions]);
  const activeAttendanceLink = activeSession
    ? created?.session.id === activeSession.id
      ? created.attendanceLink
      : attendanceLinkFromToken(activeSession.session_token)
    : null;
  const selectedSession = selectedSessionId ? historySessions.find((session) => session.id === selectedSessionId) || null : null;

  const setWorkspace = useCallback(
    (nextTab: Tab, sessionId?: string | null) => {
      setTab(nextTab);
      setSelectedSessionId(sessionId || null);
      const params = new URLSearchParams();
      params.set("tab", nextTab);
      if (nextTab === "history" && sessionId) params.set("session", sessionId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    const nextTab = searchParams.get("tab") as Tab | null;
    const session = searchParams.get("session");
    if (nextTab && validTabs.has(nextTab)) {
      setTab(nextTab);
      setSelectedSessionId(nextTab === "history" ? session : null);
    }
  }, [searchParams]);

  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setIsLoading(true);
    setError("");

    try {
      const [sectionResponse, subjectResponse, studentsResponse] = await Promise.all([
        fetch(`/api/sections/${sectionId}`, { cache: "no-store" }),
        fetch(`/api/subjects/${subjectId}`, { cache: "no-store" }),
        fetch(`/api/subjects/${subjectId}/students`, { cache: "no-store" })
      ]);

      const [sectionPayload, subjectPayload, studentsPayload] = await Promise.all([
        readJson(sectionResponse, "Sections API"),
        readJson(subjectResponse, "Subject API"),
        readJson(studentsResponse, "Students API")
      ]);

      if (!sectionResponse.ok) return setError(sectionPayload.error || "Section could not load.");
      if (!subjectResponse.ok) return setError(subjectPayload.error || "Subject could not load.");
      if (!studentsResponse.ok) return setError(studentsPayload.error || "Students could not load.");

      setSection(sectionPayload.section);
      setSubject(subjectPayload.subject);
      setSessions(subjectPayload.sessions || []);
      setStudents(studentsPayload.students || []);
    } catch {
      setError("Subject could not load. Check the server and Supabase connection.");
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, [sectionId, subjectId]);

  const loadAnalytics = useCallback(async () => {
    const response = await fetch(`/api/subjects/${subjectId}/analytics`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setAnalytics(payload);
  }, [subjectId]);

  const loadAlerts = useCallback(async () => {
    const response = await fetch(`/api/subjects/${subjectId}/alerts/settings`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setAlertSettings(payload.settings);
  }, [subjectId]);

  const loadSelectedSession = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoadingSelectedSession(true);
    setError("");
    const response = await fetch(`/api/sessions/${selectedSessionId}/records`, { cache: "no-store" });
    const payload = await response.json();
    setLoadingSelectedSession(false);

    if (!response.ok) {
      setError(payload.error || "Session records could not load.");
      return;
    }

    setSelectedSessionRecords({
      records: payload.records || [],
      counts: payload.counts || { on_time: 0, late: 0, absent: 0, sick: 0, leave: 0, excused: 0, repeatedLate: 0, repeatedAbsent: 0 }
    });
  }, [selectedSessionId]);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    setNotice("");
    setError("");
  }, [tab, selectedSessionId, pathname]);

  useEffect(() => {
    if (tab === "analytics" || tab === "alerts") loadAnalytics();
    if (tab === "alerts") loadAlerts();
  }, [loadAlerts, loadAnalytics, tab]);

  useEffect(() => {
    if (tab !== "history" || !historySessions.length || selectedSessionId) return;
    let cancelled = false;

    async function loadSummaries() {
      const entries = await Promise.all(
        historySessions.slice(0, 20).map(async (session) => {
          const response = await fetch(`/api/sessions/${session.id}/records`, { cache: "no-store" });
          const payload = await response.json();
          const counts = payload.counts || {};
          return [
            session.id,
            {
              sessionId: session.id,
              on_time: counts.on_time || 0,
              late: counts.late || 0,
              absent: counts.absent || 0,
              excused: (counts.excused || 0) + (counts.sick || 0) + (counts.leave || 0)
            }
          ] as const;
        })
      );
      if (!cancelled) setSessionSummaries(Object.fromEntries(entries));
    }

    loadSummaries();
    return () => {
      cancelled = true;
    };
  }, [historySessionKey, historySessions, selectedSessionId, tab]);

  useEffect(() => {
    if (tab !== "history" || !selectedSessionId || !sessions.length) return;
    if (!historySessions.some((session) => session.id === selectedSessionId)) setWorkspace("history");
  }, [historySessions, selectedSessionId, sessions.length, setWorkspace, tab]);

  useEffect(() => {
    if (tab !== "history" || !selectedSessionId) {
      setSelectedSessionRecords(null);
      return;
    }
    loadSelectedSession();
  }, [loadSelectedSession, selectedSessionId, tab]);

  async function startAttendance() {
    if (!section || !subject) return;

    setStarting(true);
    setError("");
    setNotice("");
    const now = new Date();
    const cutoff = new Date(now.getTime() + lateAfterMinutes * 60_000);
    const close = new Date(now.getTime() + closeAfterMinutes * 60_000);

    if (close.getTime() < cutoff.getTime()) {
      setStarting(false);
      setError("Attendance close time must be after the late threshold.");
      return;
    }

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        section_id: section.id,
        subject_id: subject.id,
        class_name: subject.name,
        session_date: now.toISOString().slice(0, 10),
        start_time: now.toISOString(),
        cutoff_time: cutoff.toISOString(),
        close_time: close.toISOString()
      })
    });
    const payload = await response.json();
    setStarting(false);

    if (!response.ok) {
      setError(payload.error || "Attendance could not start.");
      return;
    }

    setCreated(payload);
    setNotice("Attendance session is live.");
    await load();
  }

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingStudent(true);
    setError("");
    setNotice("");

    const response = await fetch(`/api/subjects/${subjectId}/students`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(studentForm)
    });
    const payload = await response.json();
    setSavingStudent(false);

    if (!response.ok) {
      setError(payload.error || "Student could not be added.");
      return false;
    }

    setStudentForm({ student_number: "", full_name: "", contact_number: "", profile_photo_data_url: "" });
    setNotice("Student saved.");
    await load();
    return true;
  }

  async function updateStudent(studentId: string, form: { student_number: string; full_name: string; contact_number: string; profile_photo_data_url: string }) {
    setUpdatingStudentId(studentId);
    setError("");
    setNotice("");

    const response = await fetch(`/api/subjects/${subjectId}/students/${studentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    setUpdatingStudentId(null);

    if (!response.ok) {
      setError(payload.error || "Student could not be updated.");
      return false;
    }

    setNotice("Student updated.");
    await load();
    return true;
  }

  async function removeStudent(studentId: string) {
    setRemovingStudentId(studentId);
    setError("");
    setNotice("");

    const response = await fetch(`/api/subjects/${subjectId}/students/${studentId}`, { method: "DELETE" });
    const payload = await response.json();
    setRemovingStudentId(null);

    if (!response.ok) {
      setError(payload.error || "Student could not be removed.");
      return false;
    }

    setNotice("Student removed from this subject.");
    await load();
    return true;
  }

  async function importExcel(file: File | null) {
    if (!file) return;
    setError("");
    setNotice("");
    setImporting(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/subjects/${subjectId}/students/import-excel`, { method: "POST", body: form });
    const payload = await response.json();
    setImporting(false);
    if (!response.ok) return setError(payload.error || "Excel import failed.");
    setImportRows(payload.rows || []);
  }

  async function saveImportRows() {
    if (!importRows) return;
    setSavingImport(true);
    const response = await fetch(`/api/subjects/${subjectId}/students/import-excel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", rows: importRows })
    });
    const payload = await response.json();
    setSavingImport(false);
    if (!response.ok) return setError(payload.error || "Reviewed rows could not be saved.");
    setImportRows(null);
    setNotice("Excel students saved.");
    await load();
  }

  async function reviewPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setNotice("");
    setReviewingPhotos(true);
    try {
      const photos = await Promise.all(
        Array.from(files).map(async (file) => ({
          filename: file.name,
          data_url: await compressImageFile(file, 400, 400, 0.65)
        }))
      );
      const response = await fetch(`/api/subjects/${subjectId}/students/photos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "review", photos })
      });
      const payload = await response.json();
      if (!response.ok) return setError(payload.error || "Photos could not be reviewed.");
      setPhotoReview(payload);
    } catch {
      setError("Photos could not be processed.");
    } finally {
      setReviewingPhotos(false);
    }
  }

  async function savePhotos() {
    if (!photoReview) return;
    setSavingPhotos(true);
    const response = await fetch(`/api/subjects/${subjectId}/students/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", matched: photoReview.matched })
    });
    const payload = await response.json();
    setSavingPhotos(false);
    if (!response.ok) return setError(payload.error || "Photos could not be saved.");
    setPhotoReview(null);
    setNotice("Profile photos saved.");
    await load();
  }

  async function saveAlertSettings(reset_period = false) {
    if (!alertSettings) return;
    setSavingAlerts(true);
    const response = await fetch(`/api/subjects/${subjectId}/alerts/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...alertSettings, reset_period })
    });
    const payload = await response.json();
    setSavingAlerts(false);
    if (!response.ok) return setError(payload.error || "Alert settings could not be saved.");
    setAlertSettings(payload.settings);
    setNotice(reset_period ? "Alert period reset." : "Alert settings saved.");
    await loadAnalytics();
  }

  async function sendSms(studentId: string, triggerType: AlertTrigger, message?: string) {
    setError("");
    setNotice("");
    const response = await fetch(`/api/subjects/${subjectId}/alerts/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ student_id: studentId, trigger_type: triggerType, message })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "SMS could not be sent.");
      return false;
    }
    setNotice("SMS alert sent.");
    await loadAnalytics();
    return true;
  }

  async function deleteSession(sessionId: string) {
    setDeletingSessionId(sessionId);
    setError("");
    setNotice("");

    const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    const payload = await response.json();
    setDeletingSessionId(null);

    if (!response.ok) {
      setError(payload.error || "Session could not be deleted.");
      return false;
    }

    setDeleteSessionTarget(null);
    setSelectedSessionRecords(null);
    if (created?.session.id === sessionId) setCreated(null);
    setNotice("Session deleted.");
    setWorkspace(tab === "history" ? "history" : "current");
    await load();
    if (tab === "analytics" || tab === "alerts") await loadAnalytics();
    return true;
  }

  const chartTotal = useMemo(() => {
    if (!analytics) return 0;
    return analytics.today.present + analytics.today.late + analytics.today.absent;
  }, [analytics]);

  if (isLoading) {
    return <SubjectWorkspaceSkeleton />;
  }

  if (!section || !subject) {
    return <div className="rounded border border-signal bg-red-50 p-4 font-semibold text-signal">{error || "Subject not found."}</div>;
  }

  return (
    <div className="grid min-w-0 gap-6">
      <section className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link href={`/sections/${section.id}`} className="focus-ring inline-flex min-h-11 max-w-full items-center gap-2 rounded px-1 py-1 text-sm font-bold uppercase text-graphite hover:text-pool">
            <ChevronLeft size={16} />
            <span className="min-w-0 break-words">{section.name}</span>
          </Link>
          <h1 className="selection-card-title mt-2 text-[clamp(2.25rem,11vw,3.75rem)] font-bold leading-[1.02] tracking-tight text-ink md:text-6xl 2xl:text-7xl">{subject.name}</h1>
        </div>
        <div className="grid gap-2 md:min-w-80">
          {notice ? <p className="rounded border border-green-700 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">{notice}</p> : null}
          {error ? <p className="rounded border border-signal bg-red-50 px-3 py-2 text-sm font-bold text-signal">{error}</p> : null}
        </div>
      </section>

      {!sidebarOpen ? (
        <button
          type="button"
          aria-label="Open workspace menu"
          onClick={() => setSidebarOpen(true)}
          className="focus-ring fixed left-0 top-1/2 z-40 flex h-16 w-11 -translate-y-1/2 items-center justify-center rounded-r bg-ledger text-white shadow-soft transition hover:bg-ink"
        >
          <ChevronRight size={22} />
        </button>
      ) : null}

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-ink/30" />
          <aside className="relative flex h-full w-full max-w-[300px] flex-col bg-ledger p-5 text-white shadow-soft">
            <div className="mb-7 flex items-center justify-between">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-white/60">Workspace</p>
              <button type="button" onClick={() => setSidebarOpen(false)} className="focus-ring grid h-11 w-11 place-items-center rounded text-white/80 hover:bg-white/10 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <nav className="grid gap-3">
              {tabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setWorkspace(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`focus-ring inline-flex w-full items-center gap-3 rounded px-4 py-4 text-left text-sm font-bold transition ${
                      active ? "bg-white text-ledger" : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}

      <section className="min-w-0">
        {tab === "current" ? (
          <CurrentTab
            activeSession={activeSession}
            activeAttendanceLink={activeAttendanceLink}
            lateAfterMinutes={lateAfterMinutes}
            setLateAfterMinutes={setLateAfterMinutes}
            closeAfterMinutes={closeAfterMinutes}
            setCloseAfterMinutes={setCloseAfterMinutes}
            starting={starting}
            startAttendance={startAttendance}
            students={students}
            studentForm={studentForm}
            setStudentForm={setStudentForm}
            addStudent={addStudent}
            savingStudent={savingStudent}
            updateStudent={updateStudent}
            removeStudent={removeStudent}
            updatingStudentId={updatingStudentId}
            removingStudentId={removingStudentId}
            importExcel={importExcel}
            importing={importing}
            reviewPhotos={reviewPhotos}
            reviewingPhotos={reviewingPhotos}
            onDeleteSession={(session) => setDeleteSessionTarget(session)}
          />
        ) : null}

        {tab === "history" ? (
          <HistoryTab
            sessions={historySessions}
            summaries={sessionSummaries}
            selectedSession={selectedSession}
            selectedSessionId={selectedSessionId}
            records={selectedSessionRecords}
            loading={loadingSelectedSession}
            openSession={(sessionId) => setWorkspace("history", sessionId)}
            back={() => setWorkspace("history")}
            reload={loadSelectedSession}
            onDeleteSession={(session) => setDeleteSessionTarget(session)}
          />
        ) : null}

        {tab === "analytics" ? <AnalyticsPanel analytics={analytics} chartTotal={chartTotal} /> : null}

        {tab === "alerts" ? (
          <AlertsPanel
            analytics={analytics}
            alertSettings={alertSettings}
            savingAlerts={savingAlerts}
            setAlertSettings={setAlertSettings}
            saveAlertSettings={saveAlertSettings}
            sendSms={sendSms}
          />
        ) : null}
      </section>

      {importRows ? (
        <ReviewModal title="Review Excel import" saving={savingImport} onClose={() => setImportRows(null)} onConfirm={saveImportRows}>
          <div className="grid max-h-[60vh] gap-2 overflow-auto">
            {importRows.map((row, index) => (
              <label key={`${row.row_number}-${index}`} className="grid gap-2 rounded border border-line bg-paper p-3 md:grid-cols-[auto_1fr_auto] md:items-center">
                <input
                  type="checkbox"
                  checked={row.save}
                  disabled={row.issues.length > 0}
                  onChange={(event) => {
                    const next = [...importRows];
                    next[index] = { ...row, save: event.target.checked };
                    setImportRows(next);
                  }}
                  className="h-5 w-5"
                />
                <div>
                  <p className="font-bold text-ink">{row.full_name || "Missing name"}</p>
                  <p className="font-mono text-xs text-graphite">{row.student_number || "Missing ID"}</p>
                </div>
                <p className={row.issues.length ? "text-sm font-bold text-signal" : "text-sm font-bold text-ledger"}>
                  {row.issues.length ? row.issues.join(", ") : "Ready"}
                </p>
              </label>
            ))}
          </div>
        </ReviewModal>
      ) : null}

      {photoReview ? (
        <ReviewModal title="Review photo upload" saving={savingPhotos} onClose={() => setPhotoReview(null)} onConfirm={savePhotos}>
          <div className="grid gap-4">
            <ReviewGroup title="Matched photos" count={photoReview.matched.length} items={photoReview.matched.map((item) => `${item.student_number} - ${item.full_name}`)} />
            <ReviewGroup title="Unmatched photos" count={photoReview.unmatched.length} items={photoReview.unmatched.map((item) => item.filename)} />
            <ReviewGroup title="Students missing photos" count={photoReview.missing.length} items={photoReview.missing.map((item) => `${item.student_number} - ${item.full_name}`)} />
          </div>
        </ReviewModal>
      ) : null}

      {deleteSessionTarget ? (
        <DeleteSessionModal
          session={deleteSessionTarget}
          saving={deletingSessionId === deleteSessionTarget.id}
          onClose={() => setDeleteSessionTarget(null)}
          onConfirm={() => deleteSession(deleteSessionTarget.id)}
        />
      ) : null}
    </div>
  );
}

function CurrentTab({
  activeSession,
  activeAttendanceLink,
  lateAfterMinutes,
  setLateAfterMinutes,
  closeAfterMinutes,
  setCloseAfterMinutes,
  starting,
  startAttendance,
  students,
  studentForm,
  setStudentForm,
  addStudent,
  savingStudent,
  updateStudent,
  removeStudent,
  updatingStudentId,
  removingStudentId,
  importExcel,
  importing,
  reviewPhotos,
  reviewingPhotos,
  onDeleteSession
}: {
  activeSession: AttendanceSession | null;
  activeAttendanceLink: string | null;
  lateAfterMinutes: number;
  setLateAfterMinutes: (value: number) => void;
  closeAfterMinutes: number;
  setCloseAfterMinutes: (value: number) => void;
  starting: boolean;
  startAttendance: () => void;
  students: Student[];
  studentForm: { student_number: string; full_name: string; contact_number: string; profile_photo_data_url: string };
  setStudentForm: (value: { student_number: string; full_name: string; contact_number: string; profile_photo_data_url: string }) => void;
  addStudent: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  savingStudent: boolean;
  updateStudent: (studentId: string, form: { student_number: string; full_name: string; contact_number: string; profile_photo_data_url: string }) => Promise<boolean>;
  removeStudent: (studentId: string) => Promise<boolean>;
  updatingStudentId: string | null;
  removingStudentId: string | null;
  importExcel: (file: File | null) => void;
  importing: boolean;
  reviewPhotos: (files: FileList | null) => void;
  reviewingPhotos: boolean;
  onDeleteSession: (session: AttendanceSession) => void;
}) {
  const [studentPanelOpen, setStudentPanelOpen] = useState(false);
  const [studentMode, setStudentMode] = useState<"manual" | "excel" | "photos">("manual");

  async function saveManualStudent(event: FormEvent<HTMLFormElement>) {
    const saved = await addStudent(event);
    if (saved) setStudentPanelOpen(false);
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(320px,460px)_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]">
      {activeSession && activeAttendanceLink ? (
        <QRCodeDisplay link={activeAttendanceLink}>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onDeleteSession(activeSession)}
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:border-red-700"
            >
              <Trash2 size={16} />
              Delete session
            </button>
          </div>
        </QRCodeDisplay>
      ) : (
        <section className="min-w-0 rounded border border-line bg-white p-4 shadow-sm sm:p-5 2xl:p-7">
          <div className="grid min-h-[320px] content-center gap-6 text-center md:min-h-[420px]">
            <div>
              <UtilityLabel>Attendance control</UtilityLabel>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">Start today&apos;s session</h2>
            </div>
            <label className="focus-within:ring-2 focus-within:ring-pool mx-auto grid min-h-12 w-full max-w-xs grid-cols-[minmax(0,1fr)_7rem] items-center rounded border border-line bg-paper px-4 py-3 text-left text-sm shadow-sm">
              <span className="font-bold text-graphite">Late after</span>
              <span className="relative flex w-28 items-center">
                <select
                  value={lateAfterMinutes}
                  onChange={(event) => setLateAfterMinutes(Number(event.target.value))}
                  className="h-8 w-full appearance-none bg-transparent pr-7 text-left font-bold leading-8 text-ink focus:outline-none"
                >
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                </select>
                <ChevronRight className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 rotate-90 text-graphite" size={16} />
              </span>
            </label>
            <label className="focus-within:ring-2 focus-within:ring-pool mx-auto grid min-h-12 w-full max-w-xs grid-cols-[minmax(0,1fr)_7rem] items-center rounded border border-line bg-paper px-4 py-3 text-left text-sm shadow-sm">
              <span className="font-bold text-graphite">Attendance closes</span>
              <span className="relative flex w-28 items-center">
                <select
                  value={closeAfterMinutes}
                  onChange={(event) => setCloseAfterMinutes(Number(event.target.value))}
                  className="h-8 w-full appearance-none bg-transparent pr-7 text-left font-bold leading-8 text-ink focus:outline-none"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hr</option>
                  <option value={90}>1 hr 30 min</option>
                  <option value={120}>2 hr</option>
                </select>
                <ChevronRight className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 rotate-90 text-graphite" size={16} />
              </span>
            </label>
            <ControlButton type="button" onClick={startAttendance} disabled={starting} className="mx-auto w-full max-w-xs py-4 text-lg">
              {starting ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
              Start attendance
            </ControlButton>
          </div>
        </section>
      )}

      {activeSession ? (
        <LiveAttendancePanel sessionId={activeSession.id} />
      ) : (
        <section className="min-w-0 overflow-hidden rounded border border-line bg-white p-4 shadow-sm sm:p-5 2xl:p-7">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-ink">Students</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setStudentMode("manual");
                  setStudentPanelOpen(true);
                }}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded border border-line bg-paper px-3 py-2 text-sm font-bold text-ink hover:border-pool"
              >
                <Plus size={16} />
                Add student
              </button>
            </div>
          </div>

          <StudentList
            students={students}
            onUpdate={updateStudent}
            onRemove={removeStudent}
            updatingStudentId={updatingStudentId}
            removingStudentId={removingStudentId}
          />

          {studentPanelOpen ? (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 px-3 py-4 sm:px-4 sm:py-8">
              <section className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded border border-line bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-pool">Student intake</p>
                    <h3 className="mt-2 text-2xl font-bold text-ink">Add student</h3>
                  </div>
                  <button type="button" onClick={() => setStudentPanelOpen(false)} className="focus-ring min-h-11 rounded border border-line px-3 py-2 text-sm font-bold text-graphite">
                    Close
                  </button>
                </div>

                <div className="mb-5 grid gap-2 sm:grid-cols-3">
                  {[
                    { id: "manual" as const, label: "Manual entry", icon: UserPlus },
                    { id: "excel" as const, label: "Import Excel", icon: FileSpreadsheet },
                    { id: "photos" as const, label: "Upload photos", icon: Upload }
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const active = studentMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setStudentMode(mode.id)}
                        className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded border px-3 py-3 text-sm font-bold ${
                          active ? "border-pool bg-blue-50 text-pool" : "border-line bg-paper text-ink hover:border-pool"
                        }`}
                      >
                        <Icon size={16} />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>

                {studentMode === "manual" ? (
                  <form onSubmit={saveManualStudent} className="grid min-w-0 gap-4 rounded border border-line bg-paper p-3 sm:p-4 lg:grid-cols-[160px_1fr]">
                    <div className="grid gap-3">
                      <div className="grid aspect-square place-items-center overflow-hidden rounded border border-line bg-white">
                        {studentForm.profile_photo_data_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={studentForm.profile_photo_data_url} alt="Student preview" className="h-full w-full object-cover" />
                        ) : (
                          <UserPlus className="text-graphite" size={42} />
                        )}
                      </div>
                      <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded border border-line bg-white px-3 py-3 text-sm font-bold text-ink hover:border-pool">
                        <Upload size={16} />
                        Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (file) setStudentForm({ ...studentForm, profile_photo_data_url: await compressImageFile(file, 400, 400, 0.65) });
                          }}
                        />
                      </label>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <input
                        value={studentForm.student_number}
                        onChange={(event) => setStudentForm({ ...studentForm, student_number: event.target.value })}
                        placeholder="Student ID"
                        className="focus-ring min-h-11 min-w-0 rounded border border-line bg-white px-3 py-3 text-sm font-bold placeholder:text-graphite/55"
                        required
                      />
                      <input
                        value={studentForm.full_name}
                        onChange={(event) => setStudentForm({ ...studentForm, full_name: event.target.value })}
                        placeholder="Full name"
                        className="focus-ring min-h-11 min-w-0 rounded border border-line bg-white px-3 py-3 text-sm font-bold placeholder:text-graphite/55"
                        required
                      />
                      <input
                        value={studentForm.contact_number}
                        onChange={(event) => setStudentForm({ ...studentForm, contact_number: event.target.value })}
                        placeholder="Contact number"
                        className="focus-ring min-h-11 min-w-0 rounded border border-line bg-white px-3 py-3 text-sm font-bold placeholder:text-graphite/55 sm:col-span-2"
                      />
                      <ControlButton disabled={savingStudent} className="sm:col-span-2">
                        {savingStudent ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                        Add to student list
                      </ControlButton>
                    </div>
                  </form>
                ) : null}

                {studentMode === "excel" ? (
                  <div className="rounded border border-line bg-paper p-4">
                    <p className="mb-4 text-sm font-semibold leading-6 text-graphite">
                      Upload an Excel file to review rows first. Saving the reviewed rows will create or update students and populate the Students panel.
                    </p>
                    <label className={`focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded bg-ledger px-4 py-3 text-sm font-bold text-white hover:bg-ink ${importing ? "opacity-60" : ""}`}>
                      {importing ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                      Choose Excel file
                      <input type="file" accept=".xlsx" className="sr-only" onChange={(event) => importExcel(event.target.files?.[0] || null)} />
                    </label>
                  </div>
                ) : null}

                {studentMode === "photos" ? (
                  <div className="rounded border border-line bg-paper p-4">
                    <p className="mb-4 text-sm font-semibold leading-6 text-graphite">
                      Upload student photos after students exist. File names should match student IDs; matched photos will fill the image column in the Students panel after review.
                    </p>
                    <label className={`focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded bg-ledger px-4 py-3 text-sm font-bold text-white hover:bg-ink ${reviewingPhotos ? "opacity-60" : ""}`}>
                      {reviewingPhotos ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      Choose photos
                      <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => reviewPhotos(event.target.files)} />
                    </label>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function HistoryTab({
  sessions,
  summaries,
  selectedSession,
  selectedSessionId,
  records,
  loading,
  openSession,
  back,
  reload,
  onDeleteSession
}: {
  sessions: AttendanceSession[];
  summaries: Record<string, SessionSummary>;
  selectedSession: AttendanceSession | null;
  selectedSessionId: string | null;
  records: SessionRecords | null;
  loading: boolean;
  openSession: (sessionId: string) => void;
  back: () => void;
  reload: () => void;
  onDeleteSession: (session: AttendanceSession) => void;
}) {
  if (selectedSessionId) {
    const counts = records?.counts;
    return (
      <section className="min-w-0 rounded border border-line bg-white p-4 shadow-sm sm:p-5 2xl:p-7">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button type="button" onClick={back} className="focus-ring mb-3 inline-flex min-h-11 items-center gap-2 rounded px-1 py-1 text-sm font-bold text-graphite hover:text-pool">
              <ChevronLeft size={16} />
              History
            </button>
            <h2 className="selection-card-title text-2xl font-bold text-ink sm:text-3xl">{selectedSession ? displayDateTime(selectedSession.start_time) : "Session records"}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/sessions/${selectedSessionId}/export/excel`} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded border border-line bg-paper px-3 py-2 text-sm font-bold text-ink hover:border-pool">
              <Download size={16} />
              Excel
            </a>
            <a href={`/api/sessions/${selectedSessionId}/export/pdf`} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded border border-line bg-paper px-3 py-2 text-sm font-bold text-ink hover:border-pool">
              <FileText size={16} />
              PDF
            </a>
            {selectedSession ? (
              <button
                type="button"
                onClick={() => onDeleteSession(selectedSession)}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:border-red-700"
              >
                <Trash2 size={16} />
                Delete session
              </button>
            ) : null}
          </div>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard label="On time" value={counts?.on_time ?? 0} tone="green" />
          <CountCard label="Late" value={counts?.late ?? 0} tone="amber" />
          <CountCard label="Absent" value={counts?.absent ?? 0} tone="gray" />
          <CountCard label="Excused" value={(counts?.excused || 0) + (counts?.sick || 0) + (counts?.leave || 0)} tone="blue" />
        </div>
        {loading ? (
          <div className="flex items-center justify-center rounded border border-line bg-paper p-8 text-graphite">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading records
          </div>
        ) : (
          <AttendanceRecordRows sessionId={selectedSessionId} records={records?.records || []} onChanged={reload} emptyText="No records for this session." />
        )}
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded border border-line bg-white p-4 shadow-sm sm:p-5 2xl:p-7">
      <div className="mb-5 flex items-center gap-2">
        <CalendarDays className="text-pool" size={22} />
        <h2 className="text-2xl font-bold text-ink">Session history</h2>
      </div>
      <div className="grid gap-3">
        {sessions.map((session) => {
          const summary = summaries[session.id];
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => openSession(session.id)}
              className="focus-ring grid min-h-16 gap-3 rounded border border-line bg-paper p-4 text-left transition hover:border-pool hover:bg-white lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div>
                <p className="break-words font-bold text-ink">{displayDateTime(session.start_time)}</p>
                <p className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.16em] text-graphite">Session record</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-graphite">
                <span>On time {summary?.on_time ?? "--"}</span>
                <span>Late {summary?.late ?? "--"}</span>
                <span>Absent {summary?.absent ?? "--"}</span>
                <span>Excused {summary?.excused ?? "--"}</span>
              </div>
            </button>
          );
        })}
        {!sessions.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No closed sessions yet.</p> : null}
      </div>
    </section>
  );
}

function StudentList({
  students,
  onUpdate,
  onRemove,
  updatingStudentId,
  removingStudentId
}: {
  students: Student[];
  onUpdate: (studentId: string, form: { student_number: string; full_name: string; contact_number: string; profile_photo_data_url: string }) => Promise<boolean>;
  onRemove: (studentId: string) => Promise<boolean>;
  updatingStudentId: string | null;
  removingStudentId: string | null;
}) {
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [removingStudent, setRemovingStudent] = useState<Student | null>(null);

  return (
    <>
      <div className="grid gap-2">
        {students.map((student) => (
          <div key={student.id} className="grid gap-3 rounded border border-line bg-paper px-3 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <StudentAvatar student={student} />
              <div className="min-w-0">
                <p className="break-words font-bold text-ink">{student.full_name}</p>
                <p className="font-mono text-xs text-graphite">{student.student_number}</p>
              </div>
            </div>
            <p className="min-w-0 break-words text-sm font-semibold text-graphite sm:text-right">{student.contact_number || "No contact number"}</p>
            <div className="flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingStudent(student)}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded border border-line bg-white text-ink hover:border-pool"
                aria-label={`Edit ${student.full_name}`}
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => setRemovingStudent(student)}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded border border-line bg-white text-red-700 hover:border-red-300 hover:bg-red-50"
                aria-label={`Remove ${student.full_name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {!students.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">Add students for this subject.</p> : null}
      </div>

      {editingStudent ? (
        <EditStudentModal
          student={editingStudent}
          saving={updatingStudentId === editingStudent.id}
          onClose={() => setEditingStudent(null)}
          onSave={async (form) => {
            const saved = await onUpdate(editingStudent.id, form);
            if (saved) setEditingStudent(null);
          }}
        />
      ) : null}

      {removingStudent ? (
        <RemoveStudentModal
          student={removingStudent}
          saving={removingStudentId === removingStudent.id}
          onClose={() => setRemovingStudent(null)}
          onConfirm={async () => {
            const removed = await onRemove(removingStudent.id);
            if (removed) setRemovingStudent(null);
          }}
        />
      ) : null}
    </>
  );
}

function EditStudentModal({
  student,
  saving,
  onClose,
  onSave
}: {
  student: Student;
  saving: boolean;
  onClose: () => void;
  onSave: (form: { student_number: string; full_name: string; contact_number: string; profile_photo_data_url: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    student_number: student.student_number,
    full_name: student.full_name,
    contact_number: student.contact_number || "",
    profile_photo_data_url: ""
  });
  const preview = form.profile_photo_data_url || student.profile_photo_url || "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 px-3 py-4 sm:px-4 sm:py-8">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-pool">Student record</p>
            <h3 className="mt-2 text-2xl font-bold text-ink">Edit student</h3>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="focus-ring min-h-11 rounded border border-line px-3 py-2 text-sm font-bold text-graphite disabled:opacity-60">
            Close
          </button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onSave(form);
          }}
          className="grid gap-4 rounded border border-line bg-paper p-3 sm:p-4 lg:grid-cols-[160px_1fr]"
        >
          <div className="grid gap-3">
            <div className="grid aspect-square place-items-center overflow-hidden rounded border border-line bg-white">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Student preview" className="h-full w-full object-cover" />
              ) : (
                <UserPlus className="text-graphite" size={42} />
              )}
            </div>
            <label className="focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded border border-line bg-white px-3 py-3 text-sm font-bold text-ink hover:border-pool">
              <Upload size={16} />
              Replace photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) setForm({ ...form, profile_photo_data_url: await compressImageFile(file, 400, 400, 0.65) });
                }}
              />
            </label>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <input
              value={form.student_number}
              onChange={(event) => setForm({ ...form, student_number: event.target.value })}
              placeholder="Student ID"
              className="focus-ring min-h-11 min-w-0 rounded border border-line bg-white px-3 py-3 text-sm font-bold placeholder:text-graphite/55"
              required
            />
            <input
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              placeholder="Full name"
              className="focus-ring min-h-11 min-w-0 rounded border border-line bg-white px-3 py-3 text-sm font-bold placeholder:text-graphite/55"
              required
            />
            <input
              value={form.contact_number}
              onChange={(event) => setForm({ ...form, contact_number: event.target.value })}
              placeholder="Contact number"
              className="focus-ring min-h-11 min-w-0 rounded border border-line bg-white px-3 py-3 text-sm font-bold placeholder:text-graphite/55 sm:col-span-2"
            />
            <ControlButton disabled={saving} className="sm:col-span-2">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Pencil size={16} />}
              Save changes
            </ControlButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function RemoveStudentModal({
  student,
  saving,
  onClose,
  onConfirm
}: {
  student: Student;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 px-3 py-4 sm:px-4 sm:py-8">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded border border-line bg-white p-4 shadow-soft sm:p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-red-700">Remove from subject</p>
        <h3 className="mt-2 break-words text-2xl font-bold text-ink">{student.full_name}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-graphite">
          This removes the student from this subject list only. Their student record and past attendance records will stay in the system.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="focus-ring min-h-11 rounded border border-line px-4 py-3 text-sm font-bold text-ink disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
            Remove student
          </button>
        </div>
      </section>
    </div>
  );
}

function DeleteSessionModal({
  session,
  saving,
  onClose,
  onConfirm
}: {
  session: AttendanceSession;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 px-3 py-4 sm:px-4 sm:py-8">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded border border-line bg-white p-4 shadow-soft sm:p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-red-700">Delete session</p>
        <h3 className="mt-2 break-words text-2xl font-bold text-ink">{displayDateTime(session.start_time)}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-graphite">
          This deletes the attendance session, all attendance records for this session, and proof photos connected to this session. This cannot be undone.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="focus-ring min-h-11 rounded border border-line px-4 py-3 text-sm font-bold text-ink disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
            Delete session
          </button>
        </div>
      </section>
    </div>
  );
}

function CountCard({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "gray" | "blue" }) {
  const tones = {
    green: "border-green-700 bg-green-50 text-green-800",
    amber: "border-orange-700 bg-orange-50 text-orange-800",
    gray: "border-gray-500 bg-gray-100 text-gray-700",
    blue: "border-pool bg-blue-50 text-pool"
  };
  return (
    <div className={`rounded border p-4 ${tones[tone]}`}>
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

const riskOrder: RiskLevel[] = ["Good", "Watch", "At Risk", "Critical"];

const riskTone: Record<RiskLevel, { text: string; bg: string; border: string; bar: string }> = {
  Good: { text: "text-green-800", bg: "bg-green-50", border: "border-green-700", bar: "bg-green-600" },
  Watch: { text: "text-amber-800", bg: "bg-amber-50", border: "border-amber-700", bar: "bg-amber-500" },
  "At Risk": { text: "text-orange-800", bg: "bg-orange-50", border: "border-orange-700", bar: "bg-orange-600" },
  Critical: { text: "text-red-800", bg: "bg-red-50", border: "border-red-700", bar: "bg-red-600" }
};

const statusTone: Record<AttendanceStatus, { label: string; dot: string; bar: string }> = {
  on_time: { label: "On time", dot: "bg-green-600", bar: "bg-green-600" },
  late: { label: "Late", dot: "bg-amber-500", bar: "bg-amber-500" },
  absent: { label: "Absent", dot: "bg-red-500", bar: "bg-red-500" },
  sick: { label: "Sick", dot: "bg-blue-500", bar: "bg-blue-500" },
  leave: { label: "Leave", dot: "bg-blue-500", bar: "bg-blue-500" },
  excused: { label: "Excused", dot: "bg-blue-500", bar: "bg-blue-500" }
};

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function AnalyticsPanel({ analytics }: { analytics: AnalyticsPayload | null; chartTotal: number }) {
  const [selectedStudent, setSelectedStudent] = useState<IndividualAnalytics | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | null>(null);
  const [historyMonth, setHistoryMonth] = useState("");

  if (!analytics) {
    return <div className="rounded border border-line bg-white p-5 shadow-soft">Loading analytics</div>;
  }

  const summary = analytics.summary || { class_attendance: 0, total_sessions: 0, students_at_risk: 0, late_count: 0, absent_count: 0, sms_alerts: 0 };
  const topCards = [
    { label: "Class Attendance", subtext: "Students who attended closed sessions.", value: `${summary.class_attendance}%`, accent: "bg-green-500" },
    { label: "Total Sessions", subtext: "Closed attendance sessions.", value: summary.total_sessions, accent: "bg-blue-500" },
    { label: "Students at Risk", subtext: "Students who may need attention.", value: summary.students_at_risk, accent: "bg-red-500" },
    { label: "Total Late", subtext: "Late records in closed sessions.", value: summary.late_count, accent: "bg-amber-500" },
    { label: "Total Absent", subtext: "Missed closed sessions.", value: summary.absent_count, accent: "bg-red-500" },
    { label: "SMS Needed", subtext: "Students who need a message.", value: summary.sms_alerts, accent: "bg-blue-500" }
  ];
  const leaderGroups = [
    { title: "Most Present", subtext: "Students with the best attendance.", rows: analytics.leaders?.most_present || [] },
    { title: "Most Late", subtext: "Students late most often.", rows: analytics.leaders?.most_late || [] },
    { title: "Most Absent", subtext: "Students absent most often.", rows: analytics.leaders?.most_absent || [] }
  ];
  const visibleStudents = riskFilter ? analytics.individual.filter((student) => student.risk === riskFilter) : analytics.individual;
  const monthOptions = selectedStudent
    ? Array.from(
        new Map(
          selectedStudent.recent_sessions.map((session) => {
            const date = new Date(session.date);
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            return [value, label];
          })
        )
      )
    : [];
  const historySessions = selectedStudent
    ? selectedStudent.recent_sessions.filter((session) => {
        if (!historyMonth) return true;
        const date = new Date(session.date);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === historyMonth;
      })
    : [];

  return (
    <>
      <section className="grid gap-5">
        <div className="rounded border border-[#07172f] bg-[#07172f] p-4 text-white shadow-soft 2xl:p-5">
          <div className="mb-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-blue-200">Analytics cockpit</p>
            <h2 className="mt-2 text-2xl font-bold">Class Summary</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {topCards.map((card) => (
              <div key={card.label} className="rounded border border-white/10 bg-white/8 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-100">{card.label}</p>
                <p className="mt-3 text-3xl font-bold">{card.value}</p>
                <p className="mt-2 min-h-10 text-sm font-semibold leading-5 text-white/70">{card.subtext}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded bg-white/10">
                  <div className={`h-full w-2/3 ${card.accent}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <section className="rounded border border-line bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-2xl font-bold text-ink">Attendance Leaders</h3>
            <p className="mt-1 text-sm font-semibold text-graphite">Quick view of top attendance patterns.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {leaderGroups.map((group) => (
              <div key={group.title} className="rounded border border-line bg-paper p-4">
                <h4 className="text-lg font-bold text-ink">{group.title}</h4>
                <p className="mt-1 text-sm font-semibold text-graphite">{group.subtext}</p>
                <div className="mt-4 grid gap-2">
                  {group.rows.map((student, index) => (
                    <div key={student.student_id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded border border-line bg-white px-3 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
                      <span className="font-mono text-xs font-bold text-graphite">{index + 1}</span>
                      <span className="break-words text-sm font-bold text-ink">{student.full_name}</span>
                      <span className="col-start-2 text-xs font-bold text-graphite sm:col-start-auto">{student.label}</span>
                    </div>
                  ))}
                  {!group.rows.length ? <p className="rounded border border-dashed border-line p-4 text-center text-sm text-graphite">No data yet.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded border border-line bg-white p-5 shadow-sm">
            <div className="mb-5">
              <h3 className="text-2xl font-bold text-ink">Attendance Over Time</h3>
              <p className="mt-1 text-sm font-semibold text-graphite">Shows on-time, late, and absent students for the last 8 closed sessions.</p>
            </div>
            <div className="grid gap-4">
              {(analytics.attendance_over_time || []).map((session) => (
                <div key={session.session_id} className="grid gap-2 md:grid-cols-[72px_1fr] md:items-center">
                  <div className="font-mono text-xs font-bold uppercase text-graphite">
                    <p>{session.label}</p>
                    <p className="mt-1 text-[11px] text-graphite/70">{session.time_label}</p>
                  </div>
                  <div>
                    <div className="flex h-7 overflow-hidden rounded border border-line bg-paper">
                      <div className={statusTone.on_time.bar} style={{ width: `${percent(session.on_time, session.total)}%` }} title={`On time ${session.on_time}`} />
                      <div className={statusTone.late.bar} style={{ width: `${percent(session.late, session.total)}%` }} title={`Late ${session.late}`} />
                      <div className={statusTone.absent.bar} style={{ width: `${percent(session.absent, session.total)}%` }} title={`Absent ${session.absent}`} />
                      <div className={statusTone.excused.bar} style={{ width: `${percent(session.excused, session.total)}%` }} title={`Excused ${session.excused}`} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs font-bold text-graphite">
                      <span>On time {session.on_time}</span>
                      <span>Late {session.late}</span>
                      <span>Absent {session.absent}</span>
                      <span>Excused {session.excused}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!analytics.attendance_over_time?.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No closed sessions yet.</p> : null}
            </div>
          </section>
        </div>

        <section className="rounded border border-line bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-2xl font-bold text-ink">Student Analytics</h3>
            <p className="mt-1 text-sm font-semibold text-graphite">Click a student to see their attendance details.</p>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRiskFilter(null)}
              className={`focus-ring min-h-11 rounded border px-3 py-2 text-sm font-bold transition ${riskFilter === null ? "border-[#2563eb] bg-blue-50 text-[#102a56]" : "border-line bg-paper text-graphite hover:border-pool"}`}
            >
              All {analytics.individual.length}
            </button>
            {riskOrder.map((risk) => {
              const count = analytics.risk_levels?.[risk] || 0;
              const selected = riskFilter === risk;
              return (
                <button
                  key={risk}
                  type="button"
                  onClick={() => setRiskFilter(selected ? null : risk)}
                  className={`focus-ring min-h-11 rounded border px-3 py-2 text-sm font-bold transition ${selected ? "border-[#2563eb] bg-blue-50 text-[#102a56]" : `${riskTone[risk].border} ${riskTone[risk].bg} ${riskTone[risk].text}`}`}
                >
                  {risk} {count}
                </button>
              );
            })}
          </div>
          {riskFilter ? (
            <div className="mb-4 flex flex-col gap-2 rounded border border-line bg-paper px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-ink">Showing: {riskFilter} students</p>
              <button type="button" onClick={() => setRiskFilter(null)} className="focus-ring min-h-11 rounded border border-line bg-white px-3 py-2 text-sm font-bold text-graphite hover:border-pool">
                Clear filter
              </button>
            </div>
          ) : null}
          <div className="grid gap-2">
            <div className="hidden grid-cols-[minmax(180px,1.4fr)_90px_70px_80px_130px_100px_150px] gap-3 px-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-graphite xl:grid">
              <span>Student</span>
              <span>Attendance</span>
              <span>Late</span>
              <span>Absent</span>
              <span>Trend</span>
              <span>Risk</span>
              <span>Action</span>
            </div>
            {visibleStudents.map((student) => {
              const tone = riskTone[student.risk];
              return (
                <button
                  key={student.student_id}
                  type="button"
                  onClick={() => {
                    setSelectedStudent(student);
                    setHistoryMonth("");
                  }}
                  className={`focus-ring grid gap-3 rounded border border-line bg-paper p-3 text-left transition hover:border-[#2563eb] hover:bg-white xl:grid-cols-[minmax(180px,1.4fr)_90px_70px_80px_130px_100px_150px] xl:items-center ${tone.border}`}
                >
                  <div className="min-w-0 border-l-4 pl-3" style={{ borderColor: student.risk === "Good" ? "#16a34a" : student.risk === "Watch" ? "#d97706" : student.risk === "At Risk" ? "#ea580c" : "#dc2626" }}>
                    <p className="break-words font-bold text-ink">{student.full_name}</p>
                    <p className="font-mono text-xs text-graphite">{student.student_number}</p>
                  </div>
                  <span className="text-sm font-bold text-ink">{student.attendance_percentage}%</span>
                  <span className="text-sm font-bold text-graphite">{student.late_count}</span>
                  <span className="text-sm font-bold text-graphite">{student.absent_count}</span>
                  <span className="text-sm font-bold text-graphite">{student.trend}</span>
                  <span className={`inline-flex w-fit rounded border px-2.5 py-1 text-xs font-bold ${tone.border} ${tone.bg} ${tone.text}`}>{student.risk}</span>
                  <span className="text-sm font-bold text-ink">{student.action}</span>
                </button>
              );
            })}
            {!analytics.individual.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No analytics yet.</p> : null}
            {analytics.individual.length > 0 && !visibleStudents.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No students in this risk level.</p> : null}
          </div>
        </section>
      </section>

      {selectedStudent ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close student details" onClick={() => setSelectedStudent(null)} className="absolute inset-0 bg-ink/35" />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-white p-4 shadow-soft sm:p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-pool">Student Details</p>
                <h3 className="mt-2 break-words text-2xl font-bold text-ink sm:text-3xl">{selectedStudent.full_name}</h3>
                <p className="font-mono text-xs text-graphite">{selectedStudent.student_number}</p>
              </div>
              <button type="button" onClick={() => setSelectedStudent(null)} className="focus-ring min-h-11 rounded border border-line px-3 py-2 text-sm font-bold text-graphite">
                <X size={16} />
              </button>
            </div>
            <p className="mb-5 text-sm font-semibold text-graphite">Attendance history and recommended action.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Attendance", `${selectedStudent.attendance_percentage}%`],
                ["On time", selectedStudent.on_time_count],
                ["Late", selectedStudent.late_count],
                ["Absent", selectedStudent.absent_count],
                ["Excused", selectedStudent.excused_count],
                ["Trend", selectedStudent.trend]
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-line bg-paper p-3">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-graphite">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded border px-2.5 py-1 text-xs font-bold ${riskTone[selectedStudent.risk].border} ${riskTone[selectedStudent.risk].bg} ${riskTone[selectedStudent.risk].text}`}>{selectedStudent.risk}</span>
                <span className="text-sm font-bold text-ink">{selectedStudent.action}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-graphite">{selectedStudent.action_sentence}</p>
            </div>
            <div className="mt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-xl font-bold text-ink">Session History</h4>
                </div>
                <label className="grid gap-1 text-sm font-bold text-graphite">
                  <span className="sr-only">Filter session history by month</span>
                  <select
                    value={historyMonth}
                    onChange={(event) => setHistoryMonth(event.target.value)}
                    className="focus-ring min-h-11 rounded border border-line bg-paper px-3 py-2 text-sm font-bold text-ink"
                  >
                    <option value="">All months</option>
                    {monthOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-2">
                {historySessions.map((session) => (
                  <div key={session.session_id} className="flex items-center justify-between rounded border border-line bg-paper px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${statusTone[session.status].dot}`} />
                      <span className="font-bold text-ink">{session.label}</span>
                    </div>
                    <span className="text-sm font-bold text-graphite">{statusTone[session.status].label}</span>
                  </div>
                ))}
                {!selectedStudent.recent_sessions.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No closed sessions yet.</p> : null}
                {selectedStudent.recent_sessions.length > 0 && !historySessions.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No sessions for this month.</p> : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function triggerForStudent(student: IndividualAnalytics, alertSettings: AlertSettings | null): AlertTrigger | null {
  const lateMilestones = alertSettings?.late_milestones?.length ? alertSettings.late_milestones : [3, 5, 7];
  const absentMilestones = alertSettings?.absent_milestones?.length ? alertSettings.absent_milestones : [2, 4, 6];
  if (student.absent_count >= Math.min(...absentMilestones)) return "absent";
  if (student.late_count >= Math.min(...lateMilestones)) return "late";
  return null;
}

function formatMilestones(value: number[]) {
  return value.join(", ");
}

function parseMilestones(value: string) {
  const numbers = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

function nextMilestone(count: number, milestones: number[]) {
  return milestones.find((milestone) => milestone >= count) || null;
}

function renderSmsTemplate(template: string, student: IndividualAnalytics, triggerType: AlertTrigger, subjectName = "this subject") {
  return template
    .replaceAll("{student}", student.full_name)
    .replaceAll("{subject}", subjectName)
    .replaceAll("{late_count}", String(student.late_count))
    .replaceAll("{absent_count}", String(student.absent_count))
    .replaceAll("{reason}", triggerType === "late" ? "late records" : "absences");
}

function AlertsPanel({
  analytics,
  alertSettings,
  savingAlerts,
  setAlertSettings,
  saveAlertSettings,
  sendSms
}: {
  analytics: AnalyticsPayload | null;
  alertSettings: AlertSettings | null;
  savingAlerts: boolean;
  setAlertSettings: (value: AlertSettings) => void;
  saveAlertSettings: (reset?: boolean) => void;
  sendSms: (studentId: string, triggerType: AlertTrigger, message?: string) => Promise<boolean>;
}) {
  const [smsDraft, setSmsDraft] = useState<{ student: IndividualAnalytics; triggerType: AlertTrigger; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  function openComposer(student: IndividualAnalytics, triggerType: AlertTrigger) {
    if (!alertSettings) return;
    const template = triggerType === "late" ? alertSettings.late_template : alertSettings.absent_template;
    setSmsDraft({ student, triggerType, message: renderSmsTemplate(template, student, triggerType) });
  }

  async function confirmSend() {
    if (!smsDraft) return;
    setSending(true);
    const sent = await sendSms(smsDraft.student.student_id, smsDraft.triggerType, smsDraft.message);
    setSending(false);
    if (sent) setSmsDraft(null);
  }

  return (
    <>
      <section className="grid min-w-0 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="min-w-0 rounded border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-ink">SMS alerts</h2>
          {alertSettings ? (
            <div className="grid gap-4">
              <label className="flex items-center justify-between rounded border border-line bg-paper px-3 py-3 text-sm font-bold text-graphite">
                Automatic SMS
                <input
                  type="checkbox"
                  checked={alertSettings.automatic_sms}
                  onChange={(event) => setAlertSettings({ ...alertSettings, automatic_sms: event.target.checked })}
                  className="h-5 w-5"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-2 text-sm font-bold text-graphite">
                  Late SMS at
                  <input
                    value={formatMilestones(alertSettings.late_milestones)}
                    onChange={(event) => setAlertSettings({ ...alertSettings, late_milestones: parseMilestones(event.target.value) })}
                    placeholder="3, 5, 7"
                    className="focus-ring min-h-11 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-graphite">
                  Absent SMS at
                  <input
                    value={formatMilestones(alertSettings.absent_milestones)}
                    onChange={(event) => setAlertSettings({ ...alertSettings, absent_milestones: parseMilestones(event.target.value) })}
                    placeholder="2, 4, 6"
                    className="focus-ring min-h-11 min-w-0 rounded border border-line bg-paper px-3 py-3 text-ink"
                  />
                </label>
              </div>
              <p className="rounded border border-line bg-paper px-3 py-3 text-sm leading-6 text-graphite">
                Automatic SMS sends only when a student lands exactly on one of these counts.
              </p>
              <label className="grid gap-2 text-sm font-bold text-graphite">
                Late template
                <textarea
                  value={alertSettings.late_template}
                  onChange={(event) => setAlertSettings({ ...alertSettings, late_template: event.target.value })}
                  rows={4}
                  className="focus-ring resize-y rounded border border-line bg-paper px-3 py-3 text-sm font-semibold leading-6 text-ink"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-graphite">
                Absent template
                <textarea
                  value={alertSettings.absent_template}
                  onChange={(event) => setAlertSettings({ ...alertSettings, absent_template: event.target.value })}
                  rows={4}
                  className="focus-ring resize-y rounded border border-line bg-paper px-3 py-3 text-sm font-semibold leading-6 text-ink"
                />
              </label>
              <p className="rounded border border-line bg-paper px-3 py-3 text-sm text-graphite">
                Placeholders: <span className="font-mono text-xs font-bold text-ink">{"{student} {subject} {late_count} {absent_count}"}</span>
              </p>
              <p className="rounded border border-line bg-paper px-3 py-3 text-sm text-graphite">
                Period start: <span className="font-bold text-ink">{displayDateTime(alertSettings.alert_period_start)}</span>
              </p>
              {alertSettings.schema_missing ? (
                <p className="rounded border border-brass bg-orange-50 px-3 py-3 text-sm font-bold text-orange-800">
                  Run the updated Supabase schema before saving alert settings.
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <ControlButton type="button" onClick={() => saveAlertSettings(false)} disabled={savingAlerts}>
                  Save alert settings
                </ControlButton>
                <button type="button" onClick={() => saveAlertSettings(true)} disabled={savingAlerts} className="focus-ring min-h-11 rounded border border-line bg-white px-4 py-3 font-bold text-ink hover:border-pool disabled:opacity-60">
                  Reset alert period
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-graphite">Loading alert settings</p>
          )}
        </div>
        <div className="min-w-0 rounded border border-line bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-ink">Needs attention</h2>
          <div className="grid gap-2">
            {(analytics?.needs_attention || []).map((student) => {
              const triggerType = triggerForStudent(student, alertSettings);
              const status = triggerType ? student.sms_alerts?.[triggerType] || "Not sent" : "No threshold";
              const canSend = Boolean(triggerType && student.contact_number);
              const milestones = triggerType === "late" ? alertSettings?.late_milestones || [3, 5, 7] : alertSettings?.absent_milestones || [2, 4, 6];
              const count = triggerType === "late" ? student.late_count : student.absent_count;
              const automaticNow = triggerType ? milestones.includes(count) : false;
              const nextAuto = triggerType ? nextMilestone(count + 1, milestones) : null;
              return (
                <div key={student.student_id} className="grid gap-3 rounded border border-line bg-paper p-3 lg:grid-cols-[1fr_120px_120px_120px] lg:items-center">
                  <div>
                    <p className="font-bold text-ink">{student.full_name}</p>
                    <p className="font-mono text-xs text-graphite">
                      {student.student_number} / Late {student.late_count} / Absent {student.absent_count}
                    </p>
                    {triggerType ? (
                      <p className="mt-1 text-xs font-bold text-graphite">
                        {automaticNow ? "Automatic SMS milestone now" : nextAuto ? `Next automatic SMS at ${triggerType} ${nextAuto}` : "No next automatic SMS set"}
                      </p>
                    ) : null}
                  </div>
                  <span className={`rounded border px-2.5 py-1 text-center text-xs font-bold ${triggerType === "absent" ? "border-red-200 bg-red-50 text-red-700" : triggerType === "late" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-line bg-white text-graphite"}`}>
                    {triggerType === "absent" ? "Absent alert" : triggerType === "late" ? "Late alert" : "No threshold"}
                  </span>
                  <span className={`rounded border px-2.5 py-1 text-center text-xs font-bold ${student.contact_number ? "border-green-200 bg-green-50 text-green-700" : "border-gray-300 bg-white text-graphite"}`}>
                    {student.contact_number ? "Has number" : "No number"}
                  </span>
                  <div className="grid gap-2">
                    <span className="text-center text-xs font-bold text-graphite">{student.contact_number ? status : "Cannot send"}</span>
                    <button
                      type="button"
                      onClick={() => triggerType && openComposer(student, triggerType)}
                      disabled={!canSend}
                      className="focus-ring min-h-11 rounded border border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-pool disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Send SMS
                    </button>
                  </div>
                </div>
              );
            })}
            {!analytics?.needs_attention?.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No students have reached the warning limits.</p> : null}
          </div>
        </div>
      </section>

      {smsDraft ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 px-3 py-4 sm:px-4 sm:py-8">
          <section className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded border border-line bg-white p-4 shadow-soft sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-graphite">{smsDraft.triggerType === "late" ? "Late warning" : "Absent warning"}</p>
                <h3 className="mt-1 break-words text-2xl font-bold text-ink">{smsDraft.student.full_name}</h3>
                <p className="mt-1 text-sm font-semibold text-graphite">{smsDraft.student.contact_number}</p>
              </div>
              <button type="button" onClick={() => setSmsDraft(null)} className="focus-ring min-h-11 rounded border border-line px-3 py-2 text-sm font-bold text-graphite">
                <X size={16} />
              </button>
            </div>
            <label className="grid gap-2 text-sm font-bold text-graphite">
              Message
              <textarea
                value={smsDraft.message}
                onChange={(event) => setSmsDraft({ ...smsDraft, message: event.target.value })}
                rows={6}
                className="focus-ring resize-y rounded border border-line bg-paper px-3 py-3 text-sm font-semibold leading-6 text-ink"
              />
            </label>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSmsDraft(null)} className="focus-ring min-h-11 rounded border border-line bg-white px-4 py-3 font-bold text-ink hover:border-pool">
                Cancel
              </button>
              <ControlButton type="button" onClick={confirmSend} disabled={sending || !smsDraft.message.trim()}>
                {sending ? <Loader2 className="animate-spin" size={16} /> : null}
                Send SMS
              </ControlButton>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ReviewModal({
  title,
  children,
  saving,
  onClose,
  onConfirm
}: {
  title: string;
  children: ReactNode;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 px-3 py-4 sm:px-4 sm:py-8">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="break-words text-2xl font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="focus-ring min-h-11 rounded border border-line px-3 py-2 text-sm font-bold text-graphite">
            Close
          </button>
        </div>
        {children}
        <ControlButton type="button" onClick={onConfirm} disabled={saving} className="mt-5">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}
          Confirm save
        </ControlButton>
      </section>
    </div>
  );
}

function ReviewGroup({ title, count, items }: { title: string; count: number; items: string[] }) {
  return (
    <div className="rounded border border-line bg-paper p-3">
      <h3 className="font-bold text-ink">
        {title} ({count})
      </h3>
      <div className="mt-2 grid gap-1 text-sm text-graphite">
        {items.slice(0, 12).map((item) => (
          <p key={item}>{item}</p>
        ))}
        {items.length > 12 ? <p className="font-bold">+{items.length - 12} more</p> : null}
        {!items.length ? <p>None</p> : null}
      </div>
    </div>
  );
}
