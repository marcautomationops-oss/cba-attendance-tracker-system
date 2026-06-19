"use client";

import { Camera, Check, ChevronDown, Loader2, X } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { statusLabel } from "@/lib/attendance";
import type { AttendanceStatus, DashboardRecord } from "@/lib/types";

const editableStatuses: AttendanceStatus[] = ["on_time", "late", "absent", "excused"];

function exactTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StudentPhoto({ record }: { record: DashboardRecord }) {
  return record.profile_photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={record.profile_photo_url} alt="" className="h-11 w-11 rounded object-cover ring-1 ring-line" />
  ) : (
    <div className="grid h-11 w-11 place-items-center rounded bg-ink text-sm font-bold text-white">{initials(record.full_name)}</div>
  );
}

function StatusMenu({
  record,
  sessionId,
  onChanged
}: {
  record: DashboardRecord;
  sessionId: string;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = !record.record_id && !record.attendance_closed;

  async function save(status: AttendanceStatus) {
    setOpen(false);
    if (status === record.status) return;

    setSaving(true);
    setError("");
    const endpoint = record.record_id ? `/api/attendance-records/${record.record_id}` : `/api/sessions/${sessionId}/records`;
    const response = await fetch(endpoint, {
      method: record.record_id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        student_id: record.student_id,
        status,
        notes: record.notes || null
      })
    });
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(payload.error || "Status could not be saved.");
      return;
    }

    onChanged?.();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={saving}
        className="focus-ring inline-flex items-center gap-1 rounded disabled:opacity-60"
        aria-label={`Change status for ${record.full_name}`}
      >
        {saving ? (
          <Loader2 className="animate-spin text-graphite" size={16} />
        ) : pending ? (
          <span className="inline-flex items-center rounded border border-line bg-white px-2.5 py-1 text-xs font-semibold text-graphite">Pending</span>
        ) : (
          <StatusBadge status={record.status} />
        )}
        <ChevronDown size={14} className="text-graphite" />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-44 rounded border border-line bg-white p-1 shadow-soft">
          {editableStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => save(status)}
              className="focus-ring flex min-h-11 w-full items-center justify-between rounded px-3 py-2 text-left text-sm font-bold text-ink hover:bg-paper"
            >
              {statusLabel(status)}
              {status === record.status ? <Check size={15} className="text-pool" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="absolute right-0 top-full z-20 mt-2 w-56 rounded border border-signal bg-red-50 px-3 py-2 text-xs font-bold text-signal">{error}</p> : null}
    </div>
  );
}

export function AttendanceRecordRows({
  sessionId,
  records,
  onChanged,
  emptyText = "No students listed yet."
}: {
  sessionId: string;
  records: DashboardRecord[];
  onChanged?: () => void;
  emptyText?: string;
}) {
  const [proof, setProof] = useState<DashboardRecord | null>(null);

  return (
    <>
      <div className="grid gap-2">
        {records.map((record) => (
          <div
            key={record.student_id}
            className="grid grid-cols-[auto_1fr] gap-3 rounded border border-line bg-paper px-3 py-3 md:grid-cols-[auto_1fr_auto_auto_auto] md:items-center"
          >
            <StudentPhoto record={record} />
            <div className="min-w-0">
              <p className="break-words font-bold text-ink">{record.full_name}</p>
              <p className="font-mono text-xs text-graphite">{record.student_number}</p>
            </div>
            <span className="font-mono text-sm font-bold text-ink">{exactTime(record.submitted_at)}</span>
            <StatusMenu record={record} sessionId={sessionId} onChanged={onChanged} />
            {record.photo_url ? (
              <button
                type="button"
                onClick={() => setProof(record)}
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line bg-white px-3 py-2 text-xs font-bold text-ink hover:border-pool"
              >
                <Camera size={14} />
                View proof
              </button>
            ) : record.photo_deleted_at || record.notes?.toLowerCase().includes("proof photo deleted") ? (
              <span className="text-xs font-bold text-graphite">Proof deleted</span>
            ) : (
              <span className="text-xs font-bold text-graphite">No proof</span>
            )}
          </div>
        ))}
        {!records.length ? <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">{emptyText}</p> : null}
      </div>

      {proof ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 px-3 py-4 sm:px-4 sm:py-8">
          <section className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded border border-line bg-white p-4 shadow-soft sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-ink">{proof.full_name}</h3>
                <p className="font-mono text-xs text-graphite">{exactTime(proof.submitted_at)}</p>
              </div>
              <button type="button" onClick={() => setProof(null)} className="focus-ring min-h-11 rounded border border-line px-3 py-2 text-sm font-bold text-graphite">
                <X size={16} />
              </button>
            </div>
            {proof.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proof.photo_url} alt="Attendance proof" className="max-h-[70vh] w-full rounded border border-line object-contain" />
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
