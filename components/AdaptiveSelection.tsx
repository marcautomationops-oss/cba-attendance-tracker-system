"use client";

import Link from "next/link";
import { ArrowRight, CircleDot, Loader2, Plus, SlidersHorizontal, X } from "lucide-react";
import type { FormEvent } from "react";

type SelectionCardProps = {
  label: string;
  name: string;
  href: string;
  actionLabel: string;
  onControl: () => void;
};

type AddItemFormProps = {
  id: string;
  label: string;
  inputLabel: string;
  placeholder: string;
  value: string;
  saving: boolean;
  submitLabel: string;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
  compact?: boolean;
};

type AddItemSheetProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function SelectionCard({ label, name, href, actionLabel, onControl }: SelectionCardProps) {
  return (
    <article className="cockpit-card focus-within:border-[#2f6fea] group relative flex min-h-[152px] flex-col overflow-hidden text-left transition hover:border-[#2f6fea] hover:shadow-soft sm:min-h-[180px] md:min-h-[240px] lg:min-h-[270px] xl:hover:-translate-y-1 2xl:min-h-[300px]">
      <Link
        href={href}
        aria-label={`${actionLabel}: ${name}`}
        className="focus-ring absolute inset-0 z-10"
      />
      <div className="pointer-events-none relative z-20 flex flex-1 flex-col justify-between gap-3 p-3 sm:gap-5 sm:p-5 md:gap-6 md:p-6 2xl:p-7">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onControl}
            className="focus-ring pointer-events-auto inline-flex min-h-11 items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#335f97] hover:text-[#061426]"
          >
            <SlidersHorizontal size={17} />
            {label}
          </button>
          <span className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#071529]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#17b26a]" />
            Active
          </span>
        </div>

        <div className="block px-1">
          <h2 className="selection-card-title font-display text-center text-[clamp(1.45rem,7vw,2rem)] font-extrabold leading-[1] tracking-[-0.035em] text-[#071529] md:text-[34px] xl:text-[38px]">
            {name}
          </h2>
        </div>

        <div className="cockpit-rule" />
      </div>
      <div className="pointer-events-none relative z-20 flex min-h-11 items-center justify-between border-t border-[#9fb9d6]/38 bg-[#eaf4ff]/70 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#061426] sm:min-h-12 sm:px-5 sm:py-3 sm:text-xs md:min-h-14 md:px-6 md:text-sm 2xl:px-7">
        <span className="min-w-0 break-words">{actionLabel}</span>
        <ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={22} />
      </div>
    </article>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
}) {
  return (
    <button
      {...props}
      className={`focus-ring inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-md bg-[#1d5edc] px-5 py-4 text-base font-extrabold text-white shadow-[0_14px_34px_rgba(47,111,234,0.24)] transition hover:bg-[#174fbd] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function AddItemForm({
  id,
  label,
  inputLabel,
  placeholder,
  value,
  saving,
  submitLabel,
  onValueChange,
  onSubmit,
  className = "",
  compact = false
}: AddItemFormProps) {
  const formClassName = compact
    ? `grid gap-5 text-left ${className}`
    : `cockpit-card cockpit-add-card flex min-h-[260px] flex-col justify-between gap-5 overflow-hidden border-dashed p-5 text-left md:min-h-[260px] md:gap-6 md:p-6 lg:min-h-[300px] 2xl:min-h-[330px] 2xl:p-7 ${className}`;

  return (
    <form
      onSubmit={onSubmit}
      className={formClassName}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex min-h-11 items-center gap-3 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#335f97]">
          <SlidersHorizontal size={17} />
          {label}
        </span>
        <CircleDot className="shrink-0 text-[#9fb9d6]" size={16} />
      </div>

      {!compact ? (
        <div className="grid gap-4 text-center">
          <div className="cockpit-plus mx-auto grid h-20 w-20 place-items-center md:h-24 md:w-24">
            <Plus className="relative z-10" size={40} />
          </div>
          <p className="font-semibold text-[#335f97]">Create a new {inputLabel.toLowerCase()}</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        <label className="text-sm font-bold text-[#6f8197]" htmlFor={id}>
          {inputLabel}
        </label>
        <input
          suppressHydrationWarning
          id={id}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          className="focus-ring min-h-12 w-full border border-[#9fb9d6]/72 bg-white/78 px-4 py-3 text-base font-bold text-[#071529] outline-none placeholder:text-[#6f8197]/62 md:text-sm"
          required
        />
        <button
          suppressHydrationWarning
          disabled={saving}
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 bg-[#061426] px-4 py-4 text-sm font-bold uppercase tracking-[0.05em] text-white transition hover:bg-[#071b33] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function AddItemSheet({ open, title, description, onClose, children }: AddItemSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#061426]/48 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-12 md:hidden">
      <section className="cockpit-card max-h-[88dvh] w-full overflow-y-auto rounded-t-xl bg-[#f7fbff] p-4 shadow-[0_24px_70px_rgba(6,20,38,0.26)] sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.035em] text-[#071529]">{title}</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-[#6f8197]">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="focus-ring grid h-11 w-11 shrink-0 place-items-center border border-[#9fb9d6]/60 text-[#335f97]" title="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
