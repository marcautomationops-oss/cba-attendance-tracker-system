import Link from "next/link";
import { LogOut, SlidersHorizontal } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

export function TeacherShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cockpit-shell">
      <header className="relative z-20 border-b border-white/10 bg-[linear-gradient(180deg,#071b33,#061426)] text-white shadow-[0_16px_34px_rgba(6,20,38,0.16)]">
        <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(320px,1fr)_auto_minmax(260px,1fr)] lg:items-center lg:px-8">
          <Link href="/dashboard" className="focus-ring inline-flex w-fit items-center rounded px-1 py-1">
            <span className="font-[family:var(--font-brand)] text-[22px] font-normal uppercase leading-none tracking-[0.075em] text-white sm:text-[26px] xl:text-[28px]">
              CBA <span className="text-[#67c7ff]">Attendance Log</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-5 text-[13px] font-medium uppercase tracking-[0.1em] text-[#b8cbe2]/72 lg:justify-center">
            <span className="inline-flex items-center tabular-nums text-[#b8cbe2]/72">
              <LiveClock />
            </span>
            <span className="hidden h-8 w-px bg-[#9fb9d6]/45 sm:block" />
            <span className="inline-flex items-center gap-2 text-[#b8cbe2]/72">
              System Status
              <span className="h-2 w-2 rounded-full bg-[#17b26a]" />
              <span className="font-normal text-[#37d978]">Online</span>
            </span>
          </div>

          <div className="flex items-center gap-3 lg:justify-end">
            <Link href="/settings" className="focus-ring inline-flex items-center gap-2 border border-[#9fb9d6]/24 bg-white/[0.025] px-4 py-3 text-sm font-medium text-[#b8cbe2]/76 transition hover:border-[#9fb9d6]/42 hover:bg-white/[0.055] hover:text-[#b8cbe2]/88">
              <SlidersHorizontal size={16} />
              Settings
            </Link>
            <span className="hidden h-8 w-px bg-[#9fb9d6]/24 sm:block" />
            <form action="/api/logout" method="post">
              <button
                suppressHydrationWarning
                className="focus-ring inline-flex items-center gap-2 border border-transparent px-3 py-3 text-sm font-medium text-[#b8cbe2]/76 transition hover:border-[#9fb9d6]/28 hover:bg-white/[0.035] hover:text-[#b8cbe2]/88"
              >
                <LogOut size={16} />
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8">{children}</main>
    </div>
  );
}
