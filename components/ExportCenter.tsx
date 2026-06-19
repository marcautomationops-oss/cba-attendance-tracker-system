"use client";

import { CalendarRange, Download, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AttendanceSummaryPayload } from "@/lib/attendanceSummary";
import type { Subject } from "@/lib/types";

type SectionOption = {
  id: string;
  name: string;
};

function formatPercent(value: number | null) {
  return value === null ? "Not counted" : `${(value * 100).toFixed(2)}%`;
}

function queryString(values: Record<string, string>) {
  return new URLSearchParams(values).toString();
}

export function ExportCenter({ sections }: { sections: SectionOption[] }) {
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [preview, setPreview] = useState<AttendanceSummaryPayload | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  function clearResult() {
    setPreview(null);
    setError("");
  }

  async function selectSection(nextSectionId: string) {
    setSectionId(nextSectionId);
    setSubjectId("");
    setSubjects([]);
    clearResult();
    if (!nextSectionId) return;

    setLoadingSubjects(true);
    try {
      const response = await fetch(`/api/sections/${nextSectionId}/subjects`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Subjects could not load.");
      setSubjects(payload.subjects || []);
    } catch (subjectError) {
      setError(subjectError instanceof Error ? subjectError.message : "Subjects could not load.");
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function loadPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingPreview(true);
    setError("");
    setPreview(null);

    try {
      const query = queryString({ sectionId, subjectId, from, to });
      const response = await fetch(`/api/exports/attendance-summary?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Attendance summary could not load.");
      setPreview(payload);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Attendance summary could not load.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function downloadExcel() {
    setDownloading(true);
    setError("");
    try {
      const query = queryString({ sectionId, subjectId, from, to });
      const response = await fetch(`/api/exports/attendance-summary/excel?${query}`);
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Excel export failed.");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "attendance-summary.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Excel export failed.");
    } finally {
      setDownloading(false);
    }
  }

  const canPreview = Boolean(sectionId && subjectId && from && to && from <= to);
  const canDownload = Boolean(preview?.closed_sessions && preview.students);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7 flex flex-col gap-3 border-b border-[#9fb9d6]/60 pb-6 md:mb-9 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#2f6fea]">Global export</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-normal text-[#071529] md:text-5xl">Attendance summary</h1>
          <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[#6f8197]">Choose a class and date range, verify the average, then export the gradebook-ready sheet.</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#47627f]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#17b26a]" />
          Closed sessions only
        </div>
      </div>

      <form onSubmit={loadPreview} className="cockpit-card grid gap-5 p-5 md:grid-cols-2 md:p-6 xl:grid-cols-[1.1fr_1.1fr_0.9fr_0.9fr_auto] xl:items-end">
        <label className="grid gap-2 text-sm font-bold text-[#47627f]">
          Section
          <select
            value={sectionId}
            onChange={(event) => selectSection(event.target.value)}
            className="focus-ring min-h-12 w-full rounded border border-[#9fb9d6] bg-white px-3 text-[#071529]"
          >
            <option value="">Choose section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-[#47627f]">
          Subject
          <span className="relative">
            <select
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                clearResult();
              }}
              disabled={!sectionId || loadingSubjects}
              className="focus-ring min-h-12 w-full rounded border border-[#9fb9d6] bg-white px-3 pr-10 text-[#071529] disabled:cursor-not-allowed disabled:bg-[#edf3fa] disabled:text-[#8193a8]"
            >
              <option value="">{loadingSubjects ? "Loading subjects" : "Choose subject"}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            {loadingSubjects ? <Loader2 className="absolute right-3 top-3.5 animate-spin text-[#2f6fea]" size={18} /> : null}
          </span>
        </label>

        <label className="grid gap-2 text-sm font-bold text-[#47627f]">
          Start date
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              clearResult();
            }}
            className="focus-ring min-h-12 rounded border border-[#9fb9d6] bg-white px-3 text-[#071529]"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-[#47627f]">
          End date
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              clearResult();
            }}
            className="focus-ring min-h-12 rounded border border-[#9fb9d6] bg-white px-3 text-[#071529]"
          />
        </label>

        <button
          type="submit"
          disabled={!canPreview || loadingPreview}
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded bg-[#071529] px-5 font-bold text-white transition hover:bg-[#163252] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loadingPreview ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
          Preview
        </button>
      </form>

      {error ? <p className="mt-5 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}

      <section className="mt-6 overflow-hidden border border-[#9fb9d6]/75 bg-white shadow-[0_18px_46px_rgba(7,21,41,0.08)]">
        <div className="grid border-b border-[#9fb9d6]/60 bg-[#eaf4ff] sm:grid-cols-3">
          {[
            ["Closed sessions", preview ? String(preview.closed_sessions) : "--"],
            ["Students", preview ? String(preview.students) : "--"],
            ["Range", preview ? `${preview.from} to ${preview.to}` : "Choose dates"]
          ].map(([label, value], index) => (
            <div key={label} className={`px-5 py-4 ${index ? "border-t border-[#9fb9d6]/50 sm:border-l sm:border-t-0" : ""}`}>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#5f7590]">{label}</p>
              <p className="mt-1 text-lg font-extrabold text-[#071529]">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-[#9fb9d6]/50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#47627f]">
            <span>Present <strong className="text-[#071529]">1</strong></span>
            <span>Late <strong className="text-[#071529]">0.5</strong></span>
            <span>Absent <strong className="text-[#071529]">0</strong></span>
            <span>Excused <strong className="text-[#071529]">0, marked E</strong></span>
          </div>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={!canDownload || downloading}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded bg-[#2f6fea] px-4 font-bold text-white transition hover:bg-[#2459bd] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {downloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            Download Excel
          </button>
        </div>

        {preview?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left">
              <thead className="bg-[#071529] text-white">
                <tr>
                  {["Student no.", "Student name", "Present", "Late", "Absent", "Excused", "Closed", "Average"].map((heading) => (
                    <th key={heading} className="border-r border-white/10 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] last:border-r-0">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={row.student_id} className={index % 2 ? "bg-[#f4f9ff]" : "bg-white"}>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 font-mono text-xs font-bold text-[#47627f]">{row.student_number}</td>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 font-bold text-[#071529]">{row.full_name}</td>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 tabular-nums">{row.present}</td>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 tabular-nums">{row.late}</td>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 tabular-nums">{row.absent}</td>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 tabular-nums">{row.excused}</td>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 tabular-nums">{row.closed_sessions}</td>
                    <td className="border-b border-[#c7d8ea] px-4 py-3 text-lg font-extrabold tabular-nums text-[#174f9c]">{formatPercent(row.attendance_average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded border border-[#9fb9d6] bg-[#eaf4ff] text-[#2f6fea]">
                {preview ? <CalendarRange size={26} /> : <FileSpreadsheet size={26} />}
              </span>
              <p className="mt-4 text-lg font-extrabold text-[#071529]">{preview ? "No attendance to summarize" : "Preview before exporting"}</p>
              <p className="mt-2 max-w-md text-sm font-medium leading-6 text-[#6f8197]">
                {preview ? "No closed sessions or active students were found for this selection." : "Select a section, subject, and date range to review every student’s calculated attendance average."}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
