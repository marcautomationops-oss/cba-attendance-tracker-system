"use client";

import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AddItemForm, AddItemSheet, PrimaryButton, SelectionCard } from "@/components/AdaptiveSelection";
import { DeleteControlModal } from "@/components/DeleteControlModal";
import { SectionWorkspaceSkeleton } from "@/components/LoadingSkeletons";
import type { Section, Subject } from "@/lib/types";

export function SectionWorkspace({ sectionId }: { sectionId: string }) {
  const [section, setSection] = useState<Section | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setIsLoading(true);
    setError("");

    try {
      const [sectionResponse, subjectsResponse] = await Promise.all([
        fetch(`/api/sections/${sectionId}`, { cache: "no-store" }),
        fetch(`/api/sections/${sectionId}/subjects`, { cache: "no-store" })
      ]);
      const [sectionPayload, subjectsPayload] = await Promise.all([sectionResponse.json(), subjectsResponse.json()]);

      if (!sectionResponse.ok) return setError(sectionPayload.error || "Section could not load.");
      if (!subjectsResponse.ok) return setError(subjectsPayload.error || "Subjects could not load.");

      setSection(sectionPayload.section);
      setSubjects(subjectsPayload.subjects || []);
    } catch {
      setError("Section could not load. Check the server connection.");
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    load(true);
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
    setMobileAddOpen(false);
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

  if (isLoading) {
    return <SectionWorkspaceSkeleton />;
  }

  if (!section) {
    return <div className="rounded border border-signal bg-red-50 p-4 font-semibold text-signal">{error || "Section not found."}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="focus-ring mb-6 inline-flex min-h-11 items-center gap-2 rounded px-1 py-1 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#6f8197] hover:text-[#2f6fea]">
        <ChevronLeft size={16} />
        Sections
      </Link>
      <div className="mb-8 text-left md:mb-12 md:text-center lg:mb-14">
        <h1 className="selection-card-title font-display text-[clamp(2.7rem,12vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.045em] text-[#071529] lg:text-7xl">{section.name}</h1>
        <p className="mt-3 text-lg font-medium leading-7 text-[#6f8197] md:mt-5">Select a subject to manage attendance</p>
      </div>
      {error ? <p className="mb-5 rounded border border-signal bg-red-50 px-3 py-2 text-sm font-semibold text-signal">{error}</p> : null}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7 lg:grid-cols-3 xl:gap-8">
        {subjects.map((subject) => (
          <SelectionCard
            key={subject.id}
            label="Subject"
            name={subject.name}
            href={`/sections/${section.id}/subjects/${subject.id}`}
            actionLabel="View subject"
            onControl={() => setSelectedSubject(subject)}
          />
        ))}

        <AddItemForm
          id="subject-name-desktop"
          label="Add new subject"
          inputLabel="Subject name"
          placeholder="Enter subject name"
          value={subjectName}
          saving={saving}
          submitLabel="Add subject"
          onValueChange={setSubjectName}
          onSubmit={addSubject}
          className="hidden md:flex md:col-span-2 lg:col-span-1"
        />
        {!subjects.length ? <p className="col-span-full text-center text-sm text-graphite">Add a subject to begin.</p> : null}
      </section>
      <div className="mt-6 grid gap-4 md:hidden">
        <PrimaryButton type="button" onClick={() => setMobileAddOpen(true)}>
          <Plus size={30} />
          Add New Subject
        </PrimaryButton>
        <p className="text-center text-base font-medium leading-6 text-[#6f8197]">Tap to create a new subject for this section.</p>
      </div>
      <AddItemSheet open={mobileAddOpen} title="Add New Subject" description="Create a subject inside this section." onClose={() => setMobileAddOpen(false)}>
        <AddItemForm
          id="subject-name-mobile"
          label="Add new subject"
          inputLabel="Subject name"
          placeholder="Enter subject name"
          value={subjectName}
          saving={saving}
          submitLabel="Add subject"
          onValueChange={setSubjectName}
          onSubmit={addSubject}
          compact
        />
      </AddItemSheet>
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
