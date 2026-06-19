function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton-block ${className}`} />;
}

export function SubjectWorkspaceSkeleton() {
  return (
    <div className="grid min-w-0 gap-6" role="status" aria-label="Loading subject workspace">
      <section className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between" aria-hidden="true">
        <div className="min-w-0 flex-1">
          <Block className="h-5 w-32" />
          <Block className="mt-5 h-[clamp(2.25rem,11vw,3.75rem)] w-[min(82%,28rem)] md:h-[3.75rem] 2xl:h-[4.5rem]" />
        </div>
        <div className="hidden md:block md:min-w-80" />
      </section>

      <div aria-hidden="true" className="fixed left-0 top-1/2 z-40 h-16 w-11 -translate-y-1/2 rounded-r bg-[#9aabc0]" />

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(320px,460px)_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]" aria-hidden="true">
        <div className="min-w-0 rounded border border-line bg-white p-4 shadow-sm sm:p-5 2xl:p-7">
          <div className="grid min-h-[320px] content-center gap-6 md:min-h-[420px]">
            <div className="grid justify-items-center gap-4">
              <Block className="h-4 w-36" />
              <Block className="h-9 w-[min(85%,20rem)] md:h-10" />
            </div>
            <Block className="mx-auto h-14 w-full max-w-xs rounded" />
            <Block className="mx-auto h-14 w-full max-w-xs rounded" />
            <Block className="mx-auto h-14 w-full max-w-xs rounded bg-[#8ca6c8]" />
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded border border-line bg-white p-4 shadow-sm sm:p-5 2xl:p-7">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Block className="h-8 w-32" />
            <Block className="h-11 w-32 rounded" />
          </div>
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex min-h-[68px] items-center gap-3 rounded border border-line/70 bg-paper/60 p-3">
                <Block className="h-11 w-11 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Block className="h-4 w-[min(70%,15rem)]" />
                  <Block className="h-3 w-[min(45%,9rem)]" />
                </div>
                <Block className="hidden h-9 w-20 rounded sm:block" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <span className="sr-only">Loading subject workspace</span>
    </div>
  );
}
