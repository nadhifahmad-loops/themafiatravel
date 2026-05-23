export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-8 overflow-hidden">
      <div className="relative">
        <div className="w-28 h-28 rounded-full border-[10px] border-orange-100"></div>

        <div className="absolute inset-0 rounded-full border-[10px] border-orange-500 border-t-transparent animate-spin"></div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/40 animate-pulse">
            <i className="fa-solid fa-plane text-white text-2xl"></i>
          </div>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-slate-800">
          Menyiapkan Perjalananmu
        </h1>

        <p className="text-slate-500 text-sm">
          Mencari harga terbaik untuk kamu...
        </p>
      </div>

      <div className="w-72 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-orange-500 animate-loading-bar rounded-full"></div>
      </div>
    </div>
  )
}