export default function HotelDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="w-2/3 h-8 bg-slate-200 rounded-lg animate-pulse"></div>
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl p-6 animate-pulse shadow-sm border border-slate-100 space-y-3">
                <div className="w-48 h-5 bg-slate-200 rounded"></div>
                <div className="w-full h-4 bg-slate-100 rounded"></div>
                <div className="w-2/3 h-4 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-3xl p-6 animate-pulse shadow-sm border border-slate-100 space-y-3 h-fit">
            <div className="w-32 h-5 bg-slate-200 rounded"></div>
            <div className="w-28 h-8 bg-orange-100 rounded-xl"></div>
            <div className="w-full h-11 bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}