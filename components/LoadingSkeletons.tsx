export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton-block ${className}`} />;
}

function SelectionCardSkeleton() {
  return (
    <article className="cockpit-card flex min-h-[260px] flex-col overflow-hidden md:min-h-[330px] lg:min-h-[360px]" aria-hidden="true">
      <div className="flex flex-1 flex-col justify-between gap-9 p-6 md:p-7">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-16" />
        </div>
        <SkeletonBlock className="mx-auto h-10 w-3/5 md:h-11" />
        <SkeletonBlock className="h-px w-full" />
      </div>
      <div className="flex min-h-16 items-center justify-between border-t border-[#9fb9d6]/38 bg-[#eaf4ff]/70 px-6 py-4 md:px-7 md:py-5">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-5 w-5" />
      </div>
    </article>
  );
}

export function SectionWorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" role="status" aria-label="Loading section">
      <SkeletonBlock className="mb-6 h-5 w-28" />
      <div className="mb-8 md:mb-12 lg:mb-14">
        <SkeletonBlock className="h-[clamp(2.7rem,12vw,4.25rem)] w-[min(80%,26rem)] md:mx-auto lg:h-[4.5rem]" />
        <SkeletonBlock className="mt-3 h-7 w-[min(75%,20rem)] md:mx-auto md:mt-5" />
      </div>
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7 lg:grid-cols-3 xl:gap-8">
        <SelectionCardSkeleton />
        <SelectionCardSkeleton />
        <article className="cockpit-card cockpit-add-card hidden min-h-[330px] flex-col justify-between gap-7 overflow-hidden border-dashed p-6 md:col-span-2 md:flex md:p-7 lg:col-span-1 lg:min-h-[360px]" aria-hidden="true">
          <div className="flex min-h-11 justify-between"><SkeletonBlock className="h-4 w-36" /><SkeletonBlock className="h-4 w-4 rounded-full" /></div>
          <SkeletonBlock className="mx-auto h-24 w-24 rounded-full" />
          <div className="grid gap-3"><SkeletonBlock className="h-4 w-24" /><SkeletonBlock className="h-12" /><SkeletonBlock className="h-12 bg-[#9aabc0]" /></div>
        </article>
      </section>
      <div className="mt-6 grid gap-4 md:hidden" aria-hidden="true"><SkeletonBlock className="h-14 rounded-md bg-[#8ca6c8]" /><SkeletonBlock className="mx-auto h-6 w-4/5" /></div>
      <span className="sr-only">Loading section</span>
    </div>
  );
}

export function SettingsPanelSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl min-w-0 gap-5" role="status" aria-label="Loading settings">
      <div><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="mt-3 h-10 w-40" /></div>
      {[0, 1].map((card) => (
        <section key={card} className="rounded border border-line bg-white p-4 shadow-sm sm:p-5" aria-hidden="true">
          <SkeletonBlock className="mb-4 h-7 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="h-12 rounded" /></div>
            <div className="grid gap-2"><SkeletonBlock className="h-4 w-36" /><SkeletonBlock className="h-12 rounded" /></div>
            {card === 0 ? <SkeletonBlock className="h-12 rounded sm:col-span-2" /> : null}
          </div>
        </section>
      ))}
      <SkeletonBlock className="h-12 rounded bg-[#8ca6c8]" />
      <span className="sr-only">Loading settings</span>
    </div>
  );
}

export function StudentAttendanceSkeleton() {
  return (
    <main className="min-h-screen px-4 py-6" role="status" aria-label="Opening attendance">
      <section className="mx-auto w-full max-w-2xl">
        <div className="mb-4 rounded border border-line bg-white p-4 shadow-soft" aria-hidden="true">
          <SkeletonBlock className="h-4 w-36" /><SkeletonBlock className="mt-3 h-10 w-3/4" /><SkeletonBlock className="mt-2 h-4 w-28" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><SkeletonBlock className="h-4 w-40" /><SkeletonBlock className="h-4 w-48" /><SkeletonBlock className="h-4 w-44" /></div>
        </div>
        <div className="grid gap-4 rounded border border-line bg-white p-4 shadow-soft" aria-hidden="true">
          <div className="grid gap-2"><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="h-12 rounded" /></div>
          <div className="grid gap-2"><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="h-12 rounded" /></div>
          <SkeletonBlock className="min-h-64 rounded bg-[#9aabc0] sm:min-h-80" />
          <div className="grid gap-2 sm:grid-cols-2"><SkeletonBlock className="h-12 rounded" /><SkeletonBlock className="h-12 rounded" /></div>
          <SkeletonBlock className="h-14 rounded bg-[#8ca6c8]" />
        </div>
      </section>
      <span className="sr-only">Opening attendance</span>
    </main>
  );
}

export function AttendanceRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2" role="status" aria-label="Loading attendance records">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex min-h-[70px] items-center gap-3 rounded border border-line bg-paper p-3" aria-hidden="true">
          <SkeletonBlock className="h-11 w-11 shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2"><SkeletonBlock className="h-4 w-[min(70%,15rem)]" /><SkeletonBlock className="h-3 w-[min(45%,9rem)]" /></div>
          <SkeletonBlock className="hidden h-8 w-20 rounded md:block" />
          <SkeletonBlock className="hidden h-8 w-20 rounded md:block" />
        </div>
      ))}
      <span className="sr-only">Loading attendance records</span>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="grid min-w-0 gap-5" role="status" aria-label="Loading analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="rounded border border-line bg-white p-4 shadow-sm"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="mt-4 h-10 w-20" /><SkeletonBlock className="mt-3 h-3 w-4/5" /></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2" aria-hidden="true">
        {[0, 1].map((item) => <section key={item} className="min-h-72 rounded border border-line bg-white p-5 shadow-sm"><SkeletonBlock className="h-7 w-48" /><SkeletonBlock className="mt-6 h-48 w-full" /></section>)}
      </div>
      <section className="rounded border border-line bg-white p-5 shadow-sm" aria-hidden="true"><SkeletonBlock className="h-7 w-44" /><div className="mt-5 grid gap-2">{Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-16 rounded" />)}</div></section>
      <span className="sr-only">Loading analytics</span>
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]" role="status" aria-label="Loading alerts">
      {[0, 1].map((panel) => (
        <div key={panel} className="min-w-0 rounded border border-line bg-white p-5 shadow-sm" aria-hidden="true">
          <SkeletonBlock className="mb-5 h-8 w-40" />
          <div className="grid gap-3">{Array.from({ length: panel ? 5 : 7 }, (_, index) => <SkeletonBlock key={index} className={`${index > 2 && !panel ? "h-24" : "h-12"} rounded`} />)}</div>
        </div>
      ))}
      <span className="sr-only">Loading alerts</span>
    </section>
  );
}
