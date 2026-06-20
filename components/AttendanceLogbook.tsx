"use client";

import { CalendarRange, FileSpreadsheet, Loader2, Save, SlidersHorizontal, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { SubjectLogbookPayload } from "@/lib/subjectLogbook";
import type { AttendanceStatus } from "@/lib/types";

type EditableStatus = "on_time" | "late" | "absent" | "excused";

const statusOptions: { value: EditableStatus; letter: string; label: string }[] = [
  { value: "on_time", letter: "P", label: "Present" },
  { value: "late", letter: "L", label: "Late" },
  { value: "absent", letter: "A", label: "Absent" },
  { value: "excused", letter: "E", label: "Excused" }
];

const statusTone: Record<EditableStatus, string> = {
  on_time: "border-green-300 bg-green-100 text-green-900",
  late: "border-amber-300 bg-amber-100 text-amber-900",
  absent: "border-red-300 bg-red-100 text-red-900",
  excused: "border-blue-300 bg-blue-100 text-blue-900"
};

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function initialRange() {
  const today = new Date();
  return {
    from: localDateValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: localDateValue(today)
  };
}

function editableStatus(status: AttendanceStatus): EditableStatus {
  return status === "sick" || status === "leave" ? "excused" : status;
}

function sessionHeader(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
  };
}

function cellKey(sessionId: string, studentId: string) {
  return `${sessionId}|${studentId}`;
}

export function AttendanceLogbook({
  subjectId,
  onDirtyChange,
  onReviewAlerts
}: {
  subjectId: string;
  onDirtyChange: (dirty: boolean) => void;
  onReviewAlerts: () => void;
}) {
  const defaults = useMemo(initialRange, []);
  const [fromInput, setFromInput] = useState(defaults.from);
  const [toInput, setToInput] = useState(defaults.to);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [logbook, setLogbook] = useState<SubjectLogbookPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditableStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileStudentId, setMobileStudentId] = useState("");
  const [mobileStudentQuery, setMobileStudentQuery] = useState("");

  const draftCount = Object.keys(drafts).length;

  const loadLogbook = useCallback(async (nextFrom: string, nextTo: string) => {
    setLoading(true);
    setError("");
    setSavedCount(0);
    try {
      const query = new URLSearchParams({ from: nextFrom, to: nextTo });
      const response = await fetch(`/api/subjects/${subjectId}/logbook?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Logbook could not load.");
      setLogbook(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Logbook could not load.");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadLogbook(from, to);
  }, [from, loadLogbook, to]);

  useEffect(() => {
    onDirtyChange(draftCount > 0);
    return () => onDirtyChange(false);
  }, [draftCount, onDirtyChange]);

  useEffect(() => {
    if (!draftCount) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftCount]);

  const displayRows = useMemo(() => {
    if (!logbook) return [];
    return logbook.rows.map((row) => {
      let present = 0;
      let late = 0;
      let absent = 0;
      let excused = 0;
      const statuses: Record<string, EditableStatus> = {};

      for (const session of logbook.sessions) {
        const key = cellKey(session.id, row.student_id);
        const status = drafts[key] || editableStatus(row.statuses[session.id]);
        statuses[session.id] = status;
        if (status === "on_time") present += 1;
        else if (status === "late") late += 1;
        else if (status === "excused") excused += 1;
        else absent += 1;
      }

      return {
        ...row,
        statuses,
        present,
        late,
        absent,
        excused,
        attendance_average: logbook.sessions.length ? (present + late * 0.5) / logbook.sessions.length : null
      };
    });
  }, [drafts, logbook]);

  useEffect(() => {
    if (!displayRows.length) {
      setMobileStudentId("");
      return;
    }
    if (!displayRows.some((row) => row.student_id === mobileStudentId)) setMobileStudentId(displayRows[0].student_id);
  }, [displayRows, mobileStudentId]);

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftCount || !fromInput || !toInput || fromInput > toInput) return;
    setFrom(fromInput);
    setTo(toInput);
    setFilterOpen(false);
  }

  function updateDraft(sessionId: string, studentId: string, originalStatus: AttendanceStatus, nextStatus: EditableStatus) {
    const key = cellKey(sessionId, studentId);
    const original = editableStatus(originalStatus);
    setSavedCount(0);
    setDrafts((current) => {
      const next = { ...current };
      if (nextStatus === original) delete next[key];
      else next[key] = nextStatus;
      return next;
    });
  }

  async function saveChanges() {
    if (!logbook || !draftCount) return;
    setSaving(true);
    setError("");
    setSavedCount(0);
    const changes = Object.entries(drafts).map(([key, status]) => {
      const [session_id, student_id] = key.split("|");
      return { session_id, student_id, status };
    });

    try {
      const response = await fetch(`/api/subjects/${subjectId}/logbook`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Logbook changes could not be saved.");
      setDrafts({});
      await loadLogbook(from, to);
      setSavedCount(payload.saved || changes.length);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Logbook changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const exportHref = `/api/subjects/${subjectId}/logbook/excel?${new URLSearchParams({ from, to })}`;
  const tableWidth = 380 + (logbook?.sessions.length || 0) * 88 + 390;
  const tabletTableWidth = 220 + (logbook?.sessions.length || 0) * 72 + 330;
  const mobileRows = displayRows.filter((row) => `${row.full_name} ${row.student_number}`.toLowerCase().includes(mobileStudentQuery.trim().toLowerCase()));
  const selectedMobileRow = mobileRows.find((row) => row.student_id === mobileStudentId) || mobileRows[0] || null;

  return (
    <section className="min-w-0 border border-line bg-white shadow-sm">
      <div className="border-b border-line bg-paper p-3 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-pool">Class record</p>
            <h2 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Attendance Logbook</h2>
          </div>
          <button type="button" onClick={() => setFilterOpen(true)} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line bg-white px-4 text-sm font-bold text-ink sm:hidden">
            <SlidersHorizontal size={17} /> Date range
          </button>
          <form onSubmit={applyRange} className="hidden gap-3 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1.5 text-sm font-bold text-graphite">
              Start date
              <input type="date" value={fromInput} disabled={draftCount > 0} onChange={(event) => setFromInput(event.target.value)} className="focus-ring min-h-11 rounded border border-line bg-white px-3 text-ink disabled:bg-gray-100" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-graphite">
              End date
              <input type="date" value={toInput} min={fromInput} disabled={draftCount > 0} onChange={(event) => setToInput(event.target.value)} className="focus-ring min-h-11 rounded border border-line bg-white px-3 text-ink disabled:bg-gray-100" />
            </label>
            <button type="submit" disabled={draftCount > 0 || !fromInput || !toInput || fromInput > toInput || loading} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line bg-white px-4 font-bold text-ink hover:border-pool disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={17} /> : <CalendarRange size={17} />}
              Apply
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {statusOptions.map((status) => (
            <span key={status.value} className={`inline-flex items-center gap-2 rounded border px-2.5 py-1 ${statusTone[status.value]}`}>
              <strong>{status.letter}</strong> {status.label}{status.value === "late" ? " · 0.5" : status.value === "on_time" ? " · 1" : " · 0"}
            </span>
          ))}
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <a href={exportHref} className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line bg-white px-4 text-sm font-bold text-ink hover:border-pool ${!logbook?.sessions.length ? "pointer-events-none opacity-50" : ""}`}>
            <FileSpreadsheet size={17} />
            Export range
          </a>
          <button type="button" onClick={() => setDrafts({})} disabled={!draftCount || saving} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line bg-white px-4 text-sm font-bold text-ink hover:border-pool disabled:opacity-50">
            <Undo2 size={17} />
            Discard
          </button>
          <button type="button" onClick={saveChanges} disabled={!draftCount || saving} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded bg-ledger px-4 text-sm font-bold text-white hover:bg-ink disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            Save changes{draftCount ? ` (${draftCount})` : ""}
          </button>
        </div>
      </div>

      {draftCount ? <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">{draftCount} unsaved {draftCount === 1 ? "change" : "changes"}. Save or discard before changing the date range.</p> : null}
      {error ? <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p> : null}
      {savedCount ? (
        <div className="flex flex-col gap-2 border-b border-green-200 bg-green-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-green-900">{savedCount} {savedCount === 1 ? "change" : "changes"} saved.</p>
          <button type="button" onClick={onReviewAlerts} className="focus-ring min-h-10 rounded border border-green-700 bg-white px-3 text-sm font-bold text-green-900">Review alerts</button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-72 place-items-center text-graphite"><Loader2 className="animate-spin" size={28} /></div>
      ) : logbook?.sessions.length ? (
        <>
          <div className="pb-16 sm:hidden">
            <div className="grid gap-3 p-3">
              <input value={mobileStudentQuery} onChange={(event) => setMobileStudentQuery(event.target.value)} placeholder="Search student" className="focus-ring min-h-11 rounded border border-line bg-paper px-3 text-sm font-bold text-ink placeholder:text-graphite/60" />
              <select value={selectedMobileRow?.student_id || ""} onChange={(event) => setMobileStudentId(event.target.value)} className="focus-ring min-h-11 min-w-0 rounded border border-line bg-white px-3 text-sm font-bold text-ink">
                {!mobileRows.length ? <option value="">No matching students</option> : null}
                {mobileRows.map((row) => <option key={row.student_id} value={row.student_id}>{row.full_name} · {row.student_number}</option>)}
              </select>

              {selectedMobileRow ? (
                <>
                  <div className="rounded border border-line bg-paper p-3">
                    <p className="break-words font-bold text-ink">{selectedMobileRow.full_name}</p>
                    <p className="font-mono text-xs text-graphite">{selectedMobileRow.student_number}</p>
                    <dl className="mt-3 grid grid-cols-4 overflow-hidden rounded border border-line bg-white text-center">
                      {[["P", selectedMobileRow.present], ["L", selectedMobileRow.late], ["A", selectedMobileRow.absent], ["E", selectedMobileRow.excused]].map(([label, value], index) => (
                        <div key={label} className={index ? "border-l border-line p-2" : "p-2"}><dt className="font-mono text-[10px] font-bold text-graphite">{label}</dt><dd className="text-lg font-extrabold text-ink">{value}</dd></div>
                      ))}
                    </dl>
                    <div className="mt-2 flex items-center justify-between rounded border border-line bg-white px-3 py-2"><span className="text-xs font-bold uppercase tracking-[0.12em] text-graphite">Average</span><strong className="text-lg text-pool">{selectedMobileRow.attendance_average === null ? "--" : `${(selectedMobileRow.attendance_average * 100).toFixed(2)}%`}</strong></div>
                  </div>

                  <div className="grid gap-2">
                    {logbook.sessions.map((session) => {
                      const status = selectedMobileRow.statuses[session.id];
                      const key = cellKey(session.id, selectedMobileRow.student_id);
                      const label = sessionHeader(session.start_time);
                      return (
                        <div key={session.id} className="flex min-h-[62px] items-center justify-between gap-3 rounded border border-line bg-white px-3 py-2">
                          <div><p className="font-bold text-ink">{label.date}</p><p className="font-mono text-xs text-graphite">{label.time}</p></div>
                          <select value={status} onChange={(event) => updateDraft(session.id, selectedMobileRow.student_id, logbook.rows.find((item) => item.student_id === selectedMobileRow.student_id)?.statuses[session.id] || "absent", event.target.value as EditableStatus)} className={`focus-ring h-11 min-w-28 rounded border px-2 text-sm font-extrabold ${statusTone[status]} ${drafts[key] ? "ring-2 ring-pool ring-offset-1" : ""}`} aria-label={`${selectedMobileRow.full_name}, ${label.date}`}>
                            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.letter} · {option.label}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : <p className="rounded border border-dashed border-line p-5 text-center text-sm text-graphite">No matching students.</p>}
            </div>

            <div className="fixed inset-x-3 bottom-[68px] z-30 grid grid-cols-[auto_1fr_1fr] gap-2 rounded border border-line bg-white/95 p-2 shadow-soft backdrop-blur">
              <a href={exportHref} className="focus-ring grid h-11 w-11 place-items-center rounded border border-line bg-paper text-ink" aria-label="Export range"><FileSpreadsheet size={17} /></a>
              <button type="button" onClick={() => setDrafts({})} disabled={!draftCount || saving} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line bg-white px-3 text-sm font-bold text-ink disabled:opacity-50"><Undo2 size={16} /> Discard</button>
              <button type="button" onClick={saveChanges} disabled={!draftCount || saving} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded bg-ledger px-3 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save{draftCount ? ` (${draftCount})` : ""}</button>
            </div>
          </div>

          <div className="hidden max-h-[68vh] overflow-auto sm:block xl:hidden">
            <table className="border-separate border-spacing-0 text-left" style={{ minWidth: tabletTableWidth }}>
              <thead className="sticky top-0 z-30 bg-ledger text-white"><tr>
                <th className="sticky left-0 z-40 w-[220px] min-w-[220px] border-b border-r border-white/15 bg-ledger px-3 py-3 font-mono text-[11px] uppercase tracking-[0.1em]">Student</th>
                {logbook.sessions.map((session) => { const label = sessionHeader(session.start_time); return <th key={session.id} className="w-[72px] min-w-[72px] border-b border-r border-white/15 px-1 py-2 text-center"><span className="block text-xs font-extrabold">{label.date}</span><span className="block font-mono text-[9px] text-white/70">{label.time}</span></th>; })}
                {['P', 'L', 'A', 'E', 'Average'].map((label) => <th key={label} className="min-w-[60px] border-b border-r border-white/15 px-2 py-3 text-center font-mono text-[10px] uppercase last:min-w-[90px]">{label}</th>)}
              </tr></thead>
              <tbody>{displayRows.map((row, rowIndex) => <tr key={row.student_id} className={rowIndex % 2 ? "bg-paper" : "bg-white"}>
                <td className={`sticky left-0 z-20 border-b border-r border-line px-3 py-2 ${rowIndex % 2 ? "bg-paper" : "bg-white"}`}><p className="font-bold text-ink">{row.full_name}</p><p className="font-mono text-[10px] text-graphite">{row.student_number}</p></td>
                {logbook.sessions.map((session) => { const status = row.statuses[session.id]; const key = cellKey(session.id, row.student_id); return <td key={session.id} className="border-b border-r border-line p-1 text-center"><select value={status} onChange={(event) => updateDraft(session.id, row.student_id, logbook.rows.find((item) => item.student_id === row.student_id)?.statuses[session.id] || "absent", event.target.value as EditableStatus)} className={`focus-ring h-10 w-11 rounded border text-center text-sm font-extrabold ${statusTone[status]} ${drafts[key] ? "ring-2 ring-pool" : ""}`} aria-label={`${row.full_name}, ${sessionHeader(session.start_time).date}`}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.letter}</option>)}</select></td>; })}
                {[row.present, row.late, row.absent, row.excused].map((value, index) => <td key={index} className="border-b border-r border-line px-2 py-2 text-center font-bold text-graphite">{value}</td>)}
                <td className="border-b border-line px-2 py-2 text-center font-extrabold text-pool">{row.attendance_average === null ? "--" : `${(row.attendance_average * 100).toFixed(0)}%`}</td>
              </tr>)}</tbody>
            </table>
          </div>

        <div className="hidden max-h-[68vh] overflow-auto xl:block">
          <table className="border-separate border-spacing-0 text-left" style={{ minWidth: tableWidth }}>
            <thead className="sticky top-0 z-30 bg-ledger text-white">
              <tr>
                <th className="sticky left-0 z-40 w-[110px] min-w-[110px] border-b border-r border-white/15 bg-ledger px-2 py-3 font-mono text-[10px] uppercase tracking-[0.1em] sm:w-[140px] sm:min-w-[140px] sm:px-3 sm:text-[11px] sm:tracking-[0.12em]">Student no.</th>
                <th className="sticky left-[110px] z-40 w-[180px] min-w-[180px] border-b border-r border-white/15 bg-ledger px-2 py-3 font-mono text-[10px] uppercase tracking-[0.1em] sm:left-[140px] sm:w-[240px] sm:min-w-[240px] sm:px-3 sm:text-[11px] sm:tracking-[0.12em]">Student name</th>
                {logbook.sessions.map((session) => {
                  const label = sessionHeader(session.start_time);
                  return (
                    <th key={session.id} className="w-[88px] min-w-[88px] border-b border-r border-white/15 px-2 py-2 text-center">
                      <span className="block text-xs font-extrabold">{label.date}</span>
                      <span className="mt-0.5 block font-mono text-[10px] font-medium text-white/70">{label.time}</span>
                    </th>
                  );
                })}
                {['P', 'L', 'A', 'E', 'Average'].map((label) => <th key={label} className="min-w-[72px] border-b border-r border-white/15 px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.1em] last:min-w-[110px]">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, rowIndex) => (
                <tr key={row.student_id} className={rowIndex % 2 ? "bg-paper" : "bg-white"}>
                  <td className={`sticky left-0 z-20 border-b border-r border-line px-2 py-2 font-mono text-[11px] font-bold text-graphite sm:px-3 sm:text-xs ${rowIndex % 2 ? "bg-paper" : "bg-white"}`}>{row.student_number}</td>
                  <td className={`sticky left-[110px] z-20 border-b border-r border-line px-2 py-2 text-sm font-bold text-ink sm:left-[140px] sm:px-3 sm:text-base ${rowIndex % 2 ? "bg-paper" : "bg-white"}`}>{row.full_name}</td>
                  {logbook.sessions.map((session) => {
                    const key = cellKey(session.id, row.student_id);
                    const status = row.statuses[session.id];
                    const edited = Boolean(drafts[key]);
                    return (
                      <td key={session.id} className="border-b border-r border-line p-1.5 text-center">
                        <select
                          aria-label={`${row.full_name}, ${sessionHeader(session.start_time).date} ${sessionHeader(session.start_time).time}`}
                          value={status}
                          onChange={(event) => updateDraft(session.id, row.student_id, logbook.rows.find((item) => item.student_id === row.student_id)?.statuses[session.id] || "absent", event.target.value as EditableStatus)}
                          className={`focus-ring h-10 w-12 rounded border text-center text-sm font-extrabold ${statusTone[status]} ${edited ? "ring-2 ring-pool ring-offset-1" : ""}`}
                          title={edited ? "Unsaved change" : statusOptions.find((option) => option.value === status)?.label}
                        >
                          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.letter}</option>)}
                        </select>
                      </td>
                    );
                  })}
                  {[row.present, row.late, row.absent, row.excused].map((value, index) => <td key={index} className="border-b border-r border-line px-3 py-2 text-center font-bold tabular-nums text-graphite">{value}</td>)}
                  <td className="border-b border-line px-3 py-2 text-center text-base font-extrabold tabular-nums text-pool">{row.attendance_average === null ? "--" : `${(row.attendance_average * 100).toFixed(2)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <div className="grid min-h-72 place-items-center px-6 text-center">
          <div><CalendarRange className="mx-auto text-pool" size={30} /><p className="mt-3 font-bold text-ink">No closed sessions in this date range.</p></div>
        </div>
      )}

      {filterOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/45 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-12 sm:hidden">
          <section className="w-full rounded-t-xl border border-line bg-white p-4 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-pool">Logbook filter</p><h3 className="mt-1 text-xl font-bold text-ink">Date range</h3></div><button type="button" onClick={() => setFilterOpen(false)} className="focus-ring grid h-11 w-11 place-items-center rounded border border-line text-graphite"><X size={18} /></button></div>
            <form onSubmit={applyRange} className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-bold text-graphite">Start date<input type="date" value={fromInput} disabled={draftCount > 0} onChange={(event) => setFromInput(event.target.value)} className="focus-ring min-h-11 rounded border border-line bg-paper px-3 text-ink" /></label>
              <label className="grid gap-1.5 text-sm font-bold text-graphite">End date<input type="date" value={toInput} min={fromInput} disabled={draftCount > 0} onChange={(event) => setToInput(event.target.value)} className="focus-ring min-h-11 rounded border border-line bg-paper px-3 text-ink" /></label>
              <button type="submit" disabled={draftCount > 0 || !fromInput || !toInput || fromInput > toInput || loading} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded bg-ledger px-4 font-bold text-white disabled:opacity-50"><CalendarRange size={17} /> Apply range</button>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
