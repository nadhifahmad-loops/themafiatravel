'use client';

import { useState } from 'react';
import { Ticket, X, Check, Loader2 } from 'lucide-react';

interface CouponData {
  id: number;
  code: string;
  name: string;
  type: string;
  value: number;
  category: string;
}

interface CouponInputProps {
  category: string;
  totalAmount: number;
  onApply: (coupon: CouponData, discountAmount: number) => void;
  onRemove: () => void;
  appliedCoupon: CouponData | null;
  discountAmount: number;
}

export default function CouponInput({ category, totalAmount, onApply, onRemove, appliedCoupon, discountAmount }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), category, totalAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memvalidasi kupon.');
      onApply(data.coupon, data.discountAmount);
      setCode('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memvalidasi kupon.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onRemove();
    setError('');
  };

  if (appliedCoupon) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-black text-emerald-800">{appliedCoupon.code}</code>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="text-[11px] text-emerald-600 mt-0.5">{appliedCoupon.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-emerald-700">-{discountAmount === totalAmount ? '100%' : `Rp${discountAmount.toLocaleString('id-ID')}`}</span>
            <button onClick={handleRemove} className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
              <X className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleApply()}
            placeholder="Masukkan kode kupon"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gunakan'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
