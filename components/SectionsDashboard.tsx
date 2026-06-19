"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AddItemForm, AddItemSheet, PrimaryButton, SelectionCard } from "@/components/AdaptiveSelection";
import { DeleteControlModal } from "@/components/DeleteControlModal";

type SectionRow = {
  id: string;
  name: string;
};

type SectionsDashboardProps = {
  initialSections: SectionRow[];
  initialError?: string;
};

export function SectionsDashboard({ initialSections, initialError = "" }: SectionsDashboardProps) {
  const [sections, setSections] = useState<SectionRow[]>(initialSections);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionRow | null>(null);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [error, setError] = useState(initialError);

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    let response: Response;
    let payload: { error?: string; section?: SectionRow };
    try {
      response = await fetch("/api/sections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name })
      });
      payload = await response.json();
    } catch {
      setSaving(false);
      setError("Section could not be added. Check the local server and Supabase connection.");
      return;
    }

    if (!response.ok) {
      setSaving(false);
      setError(payload.error || "Section could not be added.");
      return;
    }

    setSaving(false);
    setName("");
    setMobileAddOpen(false);
    const addedSection = payload.section;
    if (addedSection) {
      setSections((current) => [...current, addedSection].sort((left, right) => left.name.localeCompare(right.name)));
    }
  }

  async function deleteSection() {
    if (!selectedSection) return;
    setDeleting(true);
    setError("");

    let response: Response;
    let payload: { error?: string };
    try {
      response = await fetch(`/api/sections/${selectedSection.id}`, { method: "DELETE" });
      payload = await response.json();
    } catch {
      setDeleting(false);
      setError("Section could not be deleted. Check the local server and Supabase connection.");
      return;
    }

    if (!response.ok) {
      setDeleting(false);
      setError(payload.error || "Section could not be deleted.");
      return;
    }

    setDeleting(false);
    setSections((current) => current.filter((section) => section.id !== selectedSection.id));
    setSelectedSection(null);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 text-left md:mb-9 md:text-center lg:mb-11">
        <h1 className="font-display text-[clamp(2rem,9vw,3.25rem)] font-extrabold leading-[0.98] tracking-[-0.045em] text-[#071529] lg:text-6xl 2xl:text-7xl">Choose a section</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[#6f8197] sm:text-base md:mt-4 md:text-lg">Select a section to manage attendance</p>
      </div>
      {error ? <p className="mb-5 rounded border border-signal bg-red-50 px-3 py-2 text-sm font-semibold text-signal">{error}</p> : null}

      <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:gap-6 2xl:gap-8">
        {sections.map((section) => (
          <SelectionCard
            key={section.id}
            label="Section"
            name={section.name}
            href={`/sections/${section.id}`}
            actionLabel="View section"
            onControl={() => setSelectedSection(section)}
          />
        ))}

        <AddItemForm
          id="section-name-desktop"
          label="Add new section"
          inputLabel="Section name"
          placeholder="e.g., HUMSS11-A"
          value={name}
          saving={saving}
          submitLabel="Add section"
          onValueChange={setName}
          onSubmit={addSection}
          className="hidden md:flex md:col-span-2 lg:col-span-1"
        />
        {!sections.length ? <p className="col-span-full text-center text-sm text-graphite">Add a section to begin.</p> : null}
      </section>
      <div className="mt-6 grid gap-4 md:hidden">
        <PrimaryButton type="button" onClick={() => setMobileAddOpen(true)}>
          <Plus size={30} />
          Add New Section
        </PrimaryButton>
        <p className="text-center text-base font-medium leading-6 text-[#6f8197]">Tap to create a new section and start tracking attendance.</p>
      </div>
      <AddItemSheet open={mobileAddOpen} title="Add New Section" description="Create a section and start tracking attendance." onClose={() => setMobileAddOpen(false)}>
        <AddItemForm
          id="section-name-mobile"
          label="Add new section"
          inputLabel="Section name"
          placeholder="e.g., HUMSS11-A"
          value={name}
          saving={saving}
          submitLabel="Add section"
          onValueChange={setName}
          onSubmit={addSection}
          compact
        />
      </AddItemSheet>
      {selectedSection ? (
        <DeleteControlModal
          entityType="section"
          name={selectedSection.name}
          openHref={`/sections/${selectedSection.id}`}
          deleting={deleting}
          onClose={() => setSelectedSection(null)}
          onDelete={deleteSection}
        />
      ) : null}
    </div>
  );
}
