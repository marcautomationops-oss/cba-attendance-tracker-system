function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <article
      aria-hidden="true"
      className={`cockpit-card flex min-h-[260px] flex-col overflow-hidden md:min-h-[330px] lg:min-h-[360px] ${className}`}
    >
      <div className="flex flex-1 flex-col justify-between gap-9 p-6 md:p-7">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <div className="skeleton-block h-4 w-24" />
          <div className="skeleton-block h-4 w-16" />
        </div>
        <div className="skeleton-block mx-auto h-10 w-3/5 md:h-11" />
        <div className="skeleton-block h-px w-full" />
      </div>
      <div className="flex min-h-16 items-center justify-between border-t border-[#9fb9d6]/38 bg-[#eaf4ff]/70 px-6 py-4 md:px-7 md:py-5">
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
      className="cockpit-card cockpit-add-card hidden min-h-[330px] flex-col justify-between gap-7 overflow-hidden border-dashed p-6 md:col-span-2 md:flex md:p-7 lg:col-span-1 lg:min-h-[360px]"
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
      <div className="mb-8 text-left md:mb-12 md:text-center lg:mb-14">
        <div className="skeleton-block h-[clamp(2.7rem,12vw,4.25rem)] w-[min(90%,32rem)] md:mx-auto lg:h-[4.5rem]" />
        <div className="skeleton-block mt-3 h-7 w-[min(75%,19rem)] md:mx-auto md:mt-5" />
      </div>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7 lg:grid-cols-3 xl:gap-8">
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
