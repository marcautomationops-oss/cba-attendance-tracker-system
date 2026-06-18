"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, CircleDot, Loader2, Plus, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DeleteControlModal } from "@/components/DeleteControlModal";
import type { Section, Subject } from "@/lib/types";

export function SectionWorkspace({ sectionId }: { sectionId: string }) {
  const [section, setSection] = useState<Section | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const sectionResponse = await fetch(`/api/sections/${sectionId}`, { cache: "no-store" });
    const sectionPayload = await sectionResponse.json();

    if (!sectionResponse.ok) {
      setError(sectionPayload.error || "Section could not load.");
      setLoading(false);
      return;
    }

    const subjectsResponse = await fetch(`/api/sections/${sectionId}/subjects`, { cache: "no-store" });

    const subjectsPayload = await subjectsResponse.json();
    setLoading(false);

    if (!subjectsResponse.ok) {
      setError(subjectsPayload.error || "Subjects could not load.");
      return;
    }
    setSection(sectionPayload.section);
    setSubjects(subjectsPayload.subjects || []);
  }, [sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch(`/api/sections/${sectionId}/subjects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: subjectName })
    });
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(payload.error || "Subject could not be added.");
      return;
    }

    setSubjectName("");
    await load();
  }

  async function deleteSubject() {
    if (!selectedSubject) return;
    setDeleting(true);
    setError("");

    const response = await fetch(`/api/subjects/${selectedSubject.id}`, { method: "DELETE" });
    const payload = await response.json();
    setDeleting(false);

    if (!response.ok) {
      setError(payload.error || "Subject could not be deleted.");
      return;
    }

    setSelectedSubject(null);
    await load();
  }

  if (loading) {
    return <div className="rounded border border-line bg-white p-5 shadow-soft">Loading section</div>;
  }

  if (!section) {
    return <div className="rounded border border-signal bg-red-50 p-4 font-semibold text-signal">{error || "Section not found."}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="focus-ring mb-6 inline-flex items-center gap-2 rounded px-1 py-1 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#6f8197] hover:text-[#2f6fea]">
        <ChevronLeft size={16} />
        Sections
      </Link>
      <div className="mb-14 text-center">
        <h1 className="font-display text-5xl font-extrabold leading-none tracking-[-0.045em] text-[#071529] md:text-7xl">{section.name}</h1>
        <p className="mt-5 text-lg font-medium text-[#6f8197]">Select a subject to manage attendance</p>
      </div>
      {error ? <p className="mb-5 rounded border border-signal bg-red-50 px-3 py-2 text-sm font-semibold text-signal">{error}</p> : null}

      <section className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => (
          <div
            key={subject.id}
            className="cockpit-card focus-ring group flex min-h-[360px] flex-col overflow-hidden text-left transition hover:-translate-y-1 hover:border-[#2f6fea] hover:shadow-soft"
          >
            <div className="flex flex-1 flex-col justify-between p-7">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedSubject(subject)}
                  className="focus-ring inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#335f97] hover:text-[#061426]"
                >
                  <SlidersHorizontal size={15} />
                  Subject
                </button>
                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#071529]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#17b26a]" />
                  Active
                </span>
              </div>
              <Link href={`/sections/${section.id}/subjects/${subject.id}`} className="focus-ring block">
                <span className="block font-display text-center text-[42px] font-extrabold tracking-[-0.035em] text-[#071529]">{subject.name}</span>
              </Link>
              <div className="cockpit-rule" />
            </div>
            <Link href={`/sections/${section.id}/subjects/${subject.id}`} className="focus-ring flex items-center justify-between border-t border-[#9fb9d6]/38 bg-[#eaf4ff]/70 px-7 py-5 text-sm font-bold uppercase tracking-[0.08em] text-[#061426]">
              View subject
              <ArrowRight className="transition group-hover:translate-x-1" size={20} />
            </Link>
          </div>
        ))}

        <form
          onSubmit={addSubject}
          className="cockpit-card cockpit-add-card flex min-h-[360px] flex-col justify-between overflow-hidden border-dashed p-7 text-center"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#6f8197]">
              <SlidersHorizontal size={15} />
              Add new subject
            </span>
            <CircleDot className="text-[#9fb9d6]" size={16} />
          </div>
          <div className="grid gap-5">
            <div className="cockpit-plus mx-auto grid h-24 w-24 place-items-center">
              <Plus className="relative z-10" size={44} />
            </div>
            <p className="font-semibold text-[#335f97]">Create a new subject</p>
          </div>
          <label className="sr-only" htmlFor="subject-name">
            Add subject
          </label>
          <div className="grid gap-3">
            <input
              id="subject-name"
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
              placeholder="Enter subject name"
              className="focus-ring w-full border border-[#9fb9d6]/72 bg-white/78 px-4 py-4 text-sm font-bold text-[#071529] outline-none placeholder:text-[#6f8197]/62"
              required
            />
            <button disabled={saving} className="focus-ring inline-flex items-center justify-center gap-2 bg-[#061426] px-4 py-4 text-sm font-bold uppercase tracking-[0.05em] text-white transition hover:bg-[#071b33] disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Add subject
            </button>
          </div>
        </form>
        {!subjects.length ? <p className="col-span-full text-center text-sm text-graphite">Add a subject to begin.</p> : null}
      </section>
      {selectedSubject ? (
        <DeleteControlModal
          entityType="subject"
          name={selectedSubject.name}
          openHref={`/sections/${section.id}/subjects/${selectedSubject.id}`}
          deleting={deleting}
          onClose={() => setSelectedSubject(null)}
          onDelete={deleteSubject}
        />
      ) : null}
    </div>
  );
}
