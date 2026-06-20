"use client";

import Link from "next/link";
import { FileSpreadsheet, LogOut, MoreVertical, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { LiveClock } from "@/components/LiveClock";

export function TeacherShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="cockpit-shell">
      <header className="relative z-20 border-b border-white/10 bg-[linear-gradient(180deg,#071b33,#061426)] text-white shadow-[0_16px_34px_rgba(6,20,38,0.16)]">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4 md:hidden">
          <Link href="/dashboard" className="focus-ring inline-flex min-w-0 items-center rounded px-1 py-1">
            <span className="min-w-0 break-words font-[family:var(--font-brand)] text-[clamp(1rem,4.8vw,1.35rem)] font-normal leading-[1.05] tracking-normal text-white">
              CBA <span className="text-[#67c7ff]">Attendance Log</span>
            </span>
          </Link>

          <div className="relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="focus-ring grid h-10 w-10 place-items-center rounded border border-transparent text-[#f7fbff] transition hover:border-[#9fb9d6]/28 hover:bg-white/[0.04]"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={21} />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 z-30 w-52 rounded border border-[#9fb9d6]/28 bg-[#071b33] p-2 shadow-[0_20px_46px_rgba(0,0,0,0.28)]">
                <Link href="/exports" onClick={() => setMenuOpen(false)} className="focus-ring flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm font-bold text-[#d8e7f7] transition hover:bg-white/[0.06] hover:text-white">
                  <FileSpreadsheet size={17} />
                  Export attendance
                </Link>
                <Link href="/settings" onClick={() => setMenuOpen(false)} className="focus-ring flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm font-bold text-[#d8e7f7] transition hover:bg-white/[0.06] hover:text-white">
                  <SlidersHorizontal size={17} />
                  Settings
                </Link>
                <div className="my-1 h-px bg-white/10" />
                <form action="/api/logout" method="post">
                  <button
                    suppressHydrationWarning
                    className="focus-ring flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm font-bold text-[#d8e7f7] transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <LogOut size={17} />
                    Logout
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-2.5 sm:px-5 md:hidden">
          <div className="inline-flex items-center gap-2 text-sm font-medium tracking-[0.02em] text-[#f7fbff]">
            <span className="tabular-nums">
              <LiveClock />
            </span>
            <span className="h-2 w-2 rounded-full bg-[#17b26a]" />
            <span className="text-[#37d978]">Online</span>
          </div>
        </div>

        <div className="hidden gap-3 px-5 py-4 md:grid md:grid-cols-[minmax(220px,1fr)_auto_auto] md:items-center lg:grid-cols-[minmax(320px,1fr)_auto_minmax(260px,1fr)] lg:gap-4 lg:px-8 lg:py-5">
          <Link href="/dashboard" className="focus-ring inline-flex w-fit items-center rounded px-1 py-1">
            <span className="whitespace-nowrap font-[family:var(--font-brand)] text-[16px] font-normal uppercase leading-none tracking-[0.05em] text-white lg:text-[22px] lg:tracking-[0.075em] xl:text-[28px]">
              CBA <span className="text-[#67c7ff]">Attendance Log</span>
            </span>
          </Link>

          <div className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.1em] text-[#b8cbe2]/72 lg:justify-center lg:gap-5 lg:text-[13px]">
            <span className="inline-flex items-center tabular-nums text-[#b8cbe2]/72">
              <LiveClock />
            </span>
            <span className="h-8 w-px bg-[#9fb9d6]/45" />
            <span className="inline-flex items-center gap-2 text-[#b8cbe2]/72">
              <span className="hidden xl:inline">System Status</span>
              <span className="h-2 w-2 rounded-full bg-[#17b26a]" />
              <span className="font-normal text-[#37d978]">Online</span>
            </span>
          </div>

          <div className="flex items-center gap-2 justify-self-end lg:gap-3">
            <Link href="/exports" className="focus-ring inline-flex min-h-11 items-center gap-2 border border-[#9fb9d6]/24 bg-white/[0.025] px-3 py-2 text-sm font-medium text-[#b8cbe2]/76 transition hover:border-[#9fb9d6]/42 hover:bg-white/[0.055] hover:text-[#b8cbe2]/88 lg:px-4 lg:py-3">
              <FileSpreadsheet size={16} />
              Export
            </Link>
            <Link href="/settings" className="focus-ring inline-flex min-h-11 items-center gap-2 border border-[#9fb9d6]/24 bg-white/[0.025] px-3 py-2 text-sm font-medium text-[#b8cbe2]/76 transition hover:border-[#9fb9d6]/42 hover:bg-white/[0.055] hover:text-[#b8cbe2]/88 lg:px-4 lg:py-3">
              <SlidersHorizontal size={16} />
              Settings
            </Link>
            <span className="hidden h-8 w-px bg-[#9fb9d6]/24 sm:block" />
            <form action="/api/logout" method="post">
              <button
                suppressHydrationWarning
                className="focus-ring inline-flex min-h-11 items-center gap-2 border border-transparent px-3 py-2 text-sm font-medium text-[#b8cbe2]/76 transition hover:border-[#9fb9d6]/28 hover:bg-white/[0.035] hover:text-[#b8cbe2]/88 lg:py-3"
              >
                <LogOut size={16} />
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1440px] px-3 py-5 sm:px-5 sm:py-7 md:px-6 md:py-8 lg:px-8 lg:py-10 2xl:px-10">{children}</main>
    </div>
  );
}
