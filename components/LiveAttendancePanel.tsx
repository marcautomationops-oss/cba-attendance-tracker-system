"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttendanceRecordRows } from "@/components/AttendanceRecordRows";
import type { DashboardRecord } from "@/lib/types";

export function LiveAttendancePanel({ sessionId }: { sessionId: string }) {
  const [records, setRecords] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/sessions/${sessionId}/records`, { cache: "no-store" });
    const payload = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(payload.error || "Could not load attendance.");
      return;
    }

    setError("");
    setRecords(payload.records || []);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function safeLoad() {
      if (!cancelled) await load();
    }

    safeLoad();
    const interval = window.setInterval(safeLoad, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center rounded border border-line bg-white p-6 text-graphite">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading students
      </div>
    );
  }

  return (
    <section className="min-h-[480px] rounded border border-line bg-white p-5 shadow-soft 2xl:p-7">
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-ink">Students</h2>
      {error ? <p className="mb-3 rounded border border-signal bg-red-50 p-3 text-sm font-semibold text-signal">{error}</p> : null}
      <AttendanceRecordRows sessionId={sessionId} records={records} onChanged={load} />
    </section>
  );
}
