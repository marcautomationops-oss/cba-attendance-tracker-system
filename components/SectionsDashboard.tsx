"use client";

import Link from "next/link";
import { ArrowRight, CircleDot, Loader2, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { DeleteControlModal } from "@/components/DeleteControlModal";

type SectionRow = {
  id: string;
  name: string;
};

export function SectionsDashboard() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedSection, setSelectedSection] = useState<SectionRow | null>(null);
  const [error, setError] = useState("");

  async function loadSections() {
    setLoading(true);
    setError("");

    let response: Response;
    let payload: { error?: string; sections?: SectionRow[] };
    try {
      response = await fetch("/api/sections", { cache: "no-store" });
      payload = await response.json();
    } catch {
      setLoading(false);
      setError("Sections could not load. Check the local server and Supabase connection.");
      return;
    }

    if (!response.ok) {
      setLoading(false);
      setError(payload.error || "Sections could not load.");
      return;
    }

    setLoading(false);
    setSections(payload.sections || []);
  }

  useEffect(() => {
    loadSections();
  }, []);

  async function addSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    let response: Response;
    let payload: { error?: string };
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
    await loadSections();
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
    setSelectedSection(null);
    await loadSections();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-14 text-center">
        <h1 className="font-display text-5xl font-extrabold leading-none tracking-[-0.045em] text-[#071529] md:text-7xl">Choose a section</h1>
        <p className="mt-5 text-lg font-medium text-[#6f8197]">Select a section to manage attendance</p>
      </div>
      {error ? <p className="mb-5 rounded border border-signal bg-red-50 px-3 py-2 text-sm font-semibold text-signal">{error}</p> : null}

      <section className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.id}
            className="cockpit-card focus-ring group flex min-h-[360px] flex-col overflow-hidden text-left transition hover:-translate-y-1 hover:border-[#2f6fea] hover:shadow-soft"
          >
            <div className="flex flex-1 flex-col justify-between p-7">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedSection(section)}
                  className="focus-ring inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#335f97] hover:text-[#061426]"
                >
                  <SlidersHorizontal size={15} />
                  Section
                </button>
                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#071529]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#17b26a]" />
                  Active
                </span>
              </div>
              <Link href={`/sections/${section.id}`} className="focus-ring block">
                <h2 className="font-display text-center text-[42px] font-extrabold tracking-[-0.035em] text-[#071529]">{section.name}</h2>
              </Link>
              <div className="cockpit-rule" />
            </div>
            <Link href={`/sections/${section.id}`} className="focus-ring flex items-center justify-between border-t border-[#9fb9d6]/38 bg-[#eaf4ff]/70 px-7 py-5 text-sm font-bold uppercase tracking-[0.08em] text-[#061426]">
              View section
              <ArrowRight className="transition group-hover:translate-x-1" size={20} />
            </Link>
          </div>
        ))}

        <form
          onSubmit={addSection}
          className="cockpit-card cockpit-add-card flex min-h-[360px] flex-col justify-between overflow-hidden border-dashed p-7 text-center"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#6f8197]">
              <SlidersHorizontal size={15} />
              Add new section
            </span>
            <CircleDot className="text-[#9fb9d6]" size={16} />
          </div>
          <div className="grid gap-5">
            <div className="cockpit-plus mx-auto grid h-24 w-24 place-items-center">
              <Plus className="relative z-10" size={44} />
            </div>
            <p className="font-semibold text-[#335f97]">Create a new section</p>
          </div>
          <label className="sr-only" htmlFor="section-name">
            Add section
          </label>
          <div className="grid gap-3">
            <input
              suppressHydrationWarning
              id="section-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter section name"
              className="focus-ring w-full border border-[#9fb9d6]/72 bg-white/78 px-4 py-4 text-sm font-bold text-[#071529] outline-none placeholder:text-[#6f8197]/62"
              required
            />
            <button
              suppressHydrationWarning
              disabled={saving}
              className="focus-ring inline-flex items-center justify-center gap-2 bg-[#061426] px-4 py-4 text-sm font-bold uppercase tracking-[0.05em] text-white transition hover:bg-[#071b33] disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Add section
            </button>
          </div>
        </form>
        {!sections.length ? (
          <p className="col-span-full text-center text-sm text-graphite">{loading ? "Loading sections" : "Add a section to begin."}</p>
        ) : null}
      </section>
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
