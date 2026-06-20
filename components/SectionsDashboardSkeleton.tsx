function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <article
      aria-hidden="true"
      className={`cockpit-card flex min-h-[152px] flex-col overflow-hidden sm:min-h-[180px] md:min-h-[240px] lg:min-h-[270px] 2xl:min-h-[300px] ${className}`}
    >
      <div className="flex flex-1 flex-col justify-between gap-5 p-4 sm:p-5 md:gap-7 md:p-6 2xl:p-7">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <div className="skeleton-block h-4 w-24" />
          <div className="skeleton-block h-4 w-16" />
        </div>
        <div className="skeleton-block mx-auto h-10 w-3/5 md:h-11" />
        <div className="skeleton-block h-px w-full" />
      </div>
      <div className="flex min-h-12 items-center justify-between border-t border-[#9fb9d6]/38 bg-[#eaf4ff]/70 px-4 py-3 md:min-h-14 md:px-6">
        <div className="skeleton-block h-4 w-28" />
        <div className="skeleton-block h-5 w-5" />
      </div>
    </article>
  );
}

function AddSectionSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="cockpit-card cockpit-add-card hidden min-h-[260px] flex-col justify-between gap-6 overflow-hidden border-dashed p-6 md:col-span-2 md:flex lg:col-span-1 lg:min-h-[300px] 2xl:min-h-[330px]"
    >
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div className="skeleton-block h-4 w-36" />
        <div className="skeleton-block h-4 w-4 rounded-full" />
      </div>
      <div className="grid gap-4">
        <div className="skeleton-block mx-auto h-20 w-20 rounded-full md:h-24 md:w-24" />
        <div className="skeleton-block mx-auto h-4 w-40" />
      </div>
      <div className="grid gap-3">
        <div className="skeleton-block h-4 w-24" />
        <div className="skeleton-block h-12 w-full" />
        <div className="skeleton-block h-12 w-full bg-[#9aabc0]" />
      </div>
    </article>
  );
}

export function SectionsDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" role="status" aria-label="Loading sections">
      <div className="mb-6 text-left md:mb-9 md:text-center lg:mb-11">
        <div className="skeleton-block h-[clamp(2rem,9vw,3.25rem)] w-[min(90%,32rem)] md:mx-auto lg:h-[3.75rem] 2xl:h-[4.5rem]" />
        <div className="skeleton-block mt-2 h-6 w-[min(75%,19rem)] md:mx-auto md:mt-4" />
      </div>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:gap-6 2xl:gap-8">
        <SkeletonCard />
        <SkeletonCard />
        <AddSectionSkeleton />
      </section>

      <div className="mt-6 grid gap-4 md:hidden" aria-hidden="true">
        <div className="skeleton-block h-14 w-full rounded-md bg-[#8ca6c8]" />
        <div className="skeleton-block mx-auto h-6 w-4/5" />
      </div>
      <span className="sr-only">Loading sections</span>
    </div>
  );
}
