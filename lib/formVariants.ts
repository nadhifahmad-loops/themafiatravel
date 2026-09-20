export type FormVariant = 'dark' | 'light';

/* ─── Consistent design tokens ─── */
// Field (dark): bg-white/10, border-white/15, shadow-sm
// Field (light): bg-white, border-slate-200, shadow-sm
// Panel/Dropdown: rounded-xl, z-[300], shadow-2xl
// Label: 10px, font-medium, uppercase, tracking-wider
// Value: 13px (text-[13px]), font-medium
// Icon: orange-500
// Active: bg-orange-500/10, text-orange-600
// Toggle active: bg-orange-500 text-white

export const vField = (v: FormVariant) =>
  v === 'light'
    ? 'bg-white border border-slate-200 hover:border-orange-300/50 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/10 transition-all duration-200 shadow-sm'
    : 'bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/25 focus-within:border-white/30 focus-within:ring-2 focus-within:ring-white/10 transition-all duration-200 shadow-sm shadow-black/10';
export const vLabel    = (v: FormVariant) => v === 'light' ? 'text-slate-500' : 'text-white/50';
export const vValue    = (v: FormVariant) => v === 'light' ? 'text-slate-800' : 'text-white';
export const vPanel    = (v: FormVariant) => v === 'light' ? 'bg-white border border-slate-200 shadow-2xl' : 'bg-slate-800 border border-white/15 shadow-2xl shadow-black/30';
export const vInput    = (v: FormVariant) => v === 'light' ? 'bg-slate-50 border border-slate-200 text-slate-800 text-[13px] font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 placeholder:text-slate-400' : 'bg-white/10 border border-white/15 text-white text-[13px] font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 placeholder:text-white/40';
export const vItem     = (v: FormVariant) => v === 'light' ? 'hover:bg-orange-500/5' : 'hover:bg-white/5';
export const vItemBg   = (v: FormVariant) => v === 'light' ? 'hover:bg-orange-500/10' : 'hover:bg-orange-600/20';
export const vSub      = (v: FormVariant) => v === 'light' ? 'text-slate-400' : 'text-white/40';
export const vMuted    = (v: FormVariant) => v === 'light' ? 'text-slate-300' : 'text-white/30';
export const vCode     = (v: FormVariant) => v === 'light' ? 'bg-orange-50 text-orange-600' : 'bg-white/10 text-orange-400';
export const vDiv      = (v: FormVariant) => v === 'light' ? 'divide-slate-100/60' : 'divide-white/5';
export const vSection  = (v: FormVariant) => v === 'light' ? 'text-slate-400' : 'text-white/50';
export const vToggle   = (v: FormVariant) => v === 'light' ? 'bg-slate-100 border border-slate-200' : 'bg-white/8 border border-white/12';
export const vToggleIdle = (v: FormVariant) => v === 'light' ? 'text-slate-500 hover:text-slate-700 hover:bg-white/80' : 'text-white/60 hover:text-white hover:bg-white/5';
export const vStepper  = (v: FormVariant) => v === 'light' ? 'bg-slate-50 border border-slate-200' : 'bg-white/8 border border-white/12';
export const vStepBtn  = (v: FormVariant) => v === 'light' ? 'text-orange-500 bg-orange-50 hover:bg-orange-100 hover:text-orange-600' : 'text-orange-400 bg-orange-500/15 hover:bg-orange-500/30 hover:text-orange-300';
export const vIconCircle = (v: FormVariant) => v === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white/60';
export const vRowBorder = (v: FormVariant) => v === 'light' ? 'border-t border-white/30' : 'border-t border-white/10';
export const vEmpty     = (v: FormVariant) => v === 'light' ? 'text-slate-300' : 'text-white/30';
export const vChevron   = (v: FormVariant) => v === 'light' ? 'text-slate-400' : 'text-white/30';
export const vFieldLabel= (v: FormVariant) => v === 'light' ? 'text-slate-400' : 'text-white/40';
export const vBtnSearch = (v: FormVariant) =>
  v === 'light'
    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-md shadow-orange-500/25 hover:shadow-orange-500/35 transition-all duration-200 active:scale-95 disabled:opacity-50'
    : 'bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50';
export const vFieldError = (v: FormVariant) =>
  v === 'light'
    ? 'border-red-400! ring-2 ring-red-400/20!'
    : 'border-red-400/60! ring-2 ring-red-400/10!';
