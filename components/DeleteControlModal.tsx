"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Trash2, X } from "lucide-react";

type DeleteControlModalProps = {
  entityType: "section" | "subject";
  name: string;
  openHref: string;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
};

export function DeleteControlModal({ entityType, name, openHref, deleting, onClose, onDelete }: DeleteControlModalProps) {
  const title = entityType === "section" ? `Delete ${name}?` : `Delete ${name}?`;
  const body =
    entityType === "section"
      ? "This will delete the section, its subjects, linked students, attendance sessions, attendance records, profile photos, and proof photos. This cannot be undone."
      : "This will delete the subject, student links for this subject, attendance sessions, attendance records, and proof photos for this subject. This cannot be undone.";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#061426]/42 px-4 py-8">
      <section className="cockpit-card w-full max-w-lg bg-[#f7fbff] p-6 shadow-[0_24px_70px_rgba(6,20,38,0.22)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#335f97]">{entityType} controls</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.035em] text-[#071529]">{name}</h2>
          </div>
          <button type="button" onClick={onClose} className="focus-ring border border-[#9fb9d6]/60 p-2 text-[#335f97]" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3">
          <Link href={openHref} className="focus-ring flex items-center justify-between border border-[#9fb9d6]/60 bg-white px-4 py-3 font-bold text-[#061426]">
            Open {entityType}
            <ArrowRight size={18} />
          </Link>

          <div className="border border-[#c81e1e]/35 bg-red-50/80 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-[#c81e1e]" size={20} />
              <div>
                <h3 className="font-bold text-[#071529]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{body}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 bg-[#c81e1e] px-4 py-3 text-sm font-bold uppercase tracking-[0.06em] text-white disabled:opacity-60"
            >
              <Trash2 size={17} />
              {deleting ? "Deleting" : `Delete ${entityType}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
