import crypto from "crypto";
import { format } from "date-fns";
import type { AttendanceStatus } from "@/lib/types";

export function generateSessionToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function attendanceLink(sessionToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/attendance/${sessionToken}`;
}

export function calculateAttendanceStatus(submittedAt: Date, cutoffTime: string): AttendanceStatus {
  return submittedAt.getTime() <= new Date(cutoffTime).getTime() ? "on_time" : "late";
}

export function statusLabel(status: AttendanceStatus) {
  const labels: Record<AttendanceStatus, string> = {
    on_time: "On time",
    late: "Late",
    absent: "Absent",
    sick: "Sick",
    leave: "Leave",
    excused: "Excused"
  };
  return labels[status];
}

export function slugifySegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function displayDateTime(value: string | null) {
  if (!value) return "No submission";
  return format(new Date(value), "MMM d, yyyy h:mm a");
}

export function toLocalDateTimeValue(value: string) {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}
