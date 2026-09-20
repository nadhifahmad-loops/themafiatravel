export default function HotelSearchLoading() {
  return (
    <div className="min-h-screen bg-brand-bgLight p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="bg-white rounded-3xl p-6 animate-pulse shadow-sm border border-slate-100"
          >
            <div className="flex items-start gap-5">
              <div className="w-40 h-28 bg-slate-200 rounded-2xl shrink-0"></div>
              <div className="space-y-4 flex-1">
                <div className="w-56 h-5 bg-slate-200 rounded"></div>
                <div className="w-32 h-4 bg-slate-100 rounded"></div>
                <div className="w-72 h-3 bg-slate-100 rounded"></div>
              </div>
              <div className="space-y-3 flex flex-col items-end">
                <div className="w-28 h-8 bg-orange-100 rounded-xl"></div>
                <div className="w-20 h-4 bg-slate-100 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}