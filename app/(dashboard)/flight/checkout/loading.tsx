export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-6 animate-pulse"
            >
              <div className="w-48 h-5 bg-slate-200 rounded mb-6"></div>

              <div className="space-y-4">
                <div className="w-full h-12 bg-slate-100 rounded-xl"></div>
                <div className="w-full h-12 bg-slate-100 rounded-xl"></div>
                <div className="w-full h-12 bg-slate-100 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-6 h-fit animate-pulse">
          <div className="w-40 h-5 bg-slate-200 rounded mb-6"></div>

          <div className="space-y-4">
            <div className="w-full h-4 bg-slate-100 rounded"></div>
            <div className="w-full h-4 bg-slate-100 rounded"></div>
            <div className="w-full h-4 bg-slate-100 rounded"></div>
            <div className="w-full h-12 bg-orange-100 rounded-2xl mt-8"></div>
          </div>
        </div>
      </div>
    </div>
  )
}