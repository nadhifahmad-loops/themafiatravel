export default function InsuranceSearchLoading() {
  return (
    <div className="min-h-screen bg-brand-bgLight pt-20">
      {/* Hero skeleton */}
      <section className="relative z-10 overflow-hidden pt-4 md:pt-8 pb-2">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="space-y-3 animate-pulse">
            <div className="h-6 w-48 bg-slate-200 rounded-full"></div>
            <div className="h-8 w-72 bg-slate-200 rounded"></div>
            <div className="h-4 w-96 bg-slate-200 rounded"></div>
          </div>
          {/* Form skeleton */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-floating p-4 sm:p-6 mt-6 space-y-4 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2 w-16 bg-slate-200 rounded"></div>
                  <div className="h-10 w-full bg-slate-200 rounded-xl"></div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <div className="h-4 w-20 bg-slate-200 rounded"></div>
              <div className="h-10 w-28 bg-orange-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Content skeleton */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-5 pb-10">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Filter skeleton */}
          <div className="w-full lg:w-56 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden animate-pulse">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-200 rounded"></div>
                <div className="h-3 w-12 bg-slate-200 rounded"></div>
              </div>
              <div className="p-4 space-y-5">
                <div>
                  <div className="h-2 w-20 bg-slate-200 rounded mb-3"></div>
                  <div className="space-y-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-slate-100 rounded"></div>
                        <div className="h-2.5 w-24 bg-slate-100 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-slate-100"></div>
                <div>
                  <div className="h-2 w-16 bg-slate-200 rounded mb-3"></div>
                  <div className="space-y-2">
                    {[1,2].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-slate-100 rounded"></div>
                        <div className="h-2.5 w-20 bg-slate-100 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card skeletons */}
          <div className="flex-1 min-w-0 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col md:flex-row gap-4 animate-pulse">
                <div className="flex items-center gap-3 md:w-52">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl shrink-0"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-28 bg-slate-200 rounded"></div>
                    <div className="h-2 w-20 bg-slate-200 rounded"></div>
                    <div className="h-2 w-16 bg-slate-200 rounded"></div>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-2 w-3/4 bg-slate-200 rounded"></div>
                  <div className="h-2 w-1/2 bg-slate-200 rounded"></div>
                  <div className="h-2 w-2/3 bg-slate-200 rounded"></div>
                </div>
                <div className="md:w-48 space-y-2 flex flex-col items-end">
                  <div className="h-3 w-20 bg-slate-200 rounded"></div>
                  <div className="h-7 w-32 bg-orange-100 rounded"></div>
                  <div className="h-9 w-full bg-slate-200 rounded-xl mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
