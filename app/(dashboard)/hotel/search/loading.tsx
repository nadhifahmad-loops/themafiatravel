export default function HotelSearchLoading() {
  return (
    <div className="min-h-screen bg-brand-bgLight pt-20">
      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
        {/* Compact bar skeleton */}
        <div className="mb-5 h-16 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-card" />

        <div className="flex flex-col items-start gap-5 lg:flex-row">
          {/* Sidebar skeleton */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="h-80 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-card" />
          </aside>

          {/* Result cards skeleton */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
                  <div className="flex flex-1 items-start gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-2/3 rounded bg-slate-100" />
                      <div className="h-3 w-1/3 rounded bg-slate-100" />
                      <div className="flex gap-2 pt-1">
                        <div className="h-5 w-24 rounded-full bg-slate-100" />
                        <div className="h-5 w-20 rounded-full bg-slate-100" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-4 border-t border-slate-100 pt-4 md:w-56 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
                    <div className="space-y-2">
                      <div className="h-2.5 w-16 rounded bg-slate-100" />
                      <div className="h-6 w-32 rounded bg-orange-100" />
                    </div>
                    <div className="h-10 w-28 rounded-xl bg-orange-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
