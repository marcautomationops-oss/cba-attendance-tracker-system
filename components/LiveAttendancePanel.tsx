"use client";

import { useCallback, useEffect, useState } from "react";
import { AttendanceRecordRows } from "@/components/AttendanceRecordRows";
import { AttendanceRowsSkeleton, SkeletonBlock } from "@/components/LoadingSkeletons";
import type { DashboardRecord } from "@/lib/types";

export function LiveAttendancePanel({ sessionId }: { sessionId: string }) {
  const [records, setRecords] = useState<DashboardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/records`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Could not load attendance.");
        return;
      }
      setError("");
      setRecords(payload.records || []);
    } catch {
      setError("Could not load attendance. Check the server connection.");
    } finally {
      setIsLoading(false);
    }
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

  if (isLoading) {
    return (
      <section className="min-h-[360px] rounded border border-line bg-white p-4 shadow-soft sm:p-5 md:min-h-[480px] 2xl:p-7">
        <SkeletonBlock className="mb-5 h-8 w-32" />
        <AttendanceRowsSkeleton />
      </section>
    );
  }

  return (
    <section className="min-h-[360px] rounded border border-line bg-white p-4 shadow-soft sm:p-5 md:min-h-[480px] 2xl:p-7">
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-ink">Students</h2>
      {error ? <p className="mb-3 rounded border border-signal bg-red-50 p-3 text-sm font-semibold text-signal">{error}</p> : null}
      <AttendanceRecordRows sessionId={sessionId} records={records} onChanged={load} />
    </section>
  );
}
