'use client';
import { memo, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';
import { sanitizeInsuranceHtml } from '@/lib/insurance-html';

function fmtIDR(n: number) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  assistcard:    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',  label: 'Assist Card' },
  bcainsurance:  { bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200',   label: 'BCA Insurance' },
  zurich:        { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200',label: 'Zurich' },
  great_eastern: { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',label: 'Great Eastern' },
  oona:          { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200',label: 'Oona' },
};

// Bersihkan & render HTML dari provider (BCA, Oona: HTML tabel; AssistCard: plain text + <br>)
function InfoRenderer({ html }: { html: string }) {
  if (!html?.trim()) return null;

  const hasRichHtml = /<(table|tr|td|th|ul|ol|li|div|p)\b/i.test(html);

  if (hasRichHtml) {
    const safeHtml = sanitizeInsuranceHtml(html);
    return (
      <>
        <style>{`
          .ins-benefit table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
          .ins-benefit th{background:#f1f5f9;color:#334155;padding:6px 10px;text-align:left;font-weight:700;font-size:11px;letter-spacing:.04em;border:1px solid #e2e8f0}
          .ins-benefit td{padding:6px 10px;color:#475569;border:1px solid #e2e8f0;font-size:12px;vertical-align:top;line-height:1.55}
          .ins-benefit tr:nth-child(even) td{background:#f8fafc}
          .ins-benefit b,.ins-benefit strong{color:#0f172a;font-weight:700}
          .ins-benefit ul{padding-left:18px;margin:4px 0}.ins-benefit li{color:#475569;font-size:12px;margin-bottom:3px;line-height:1.5}
          .ins-benefit p{color:#475569;font-size:12px;margin:4px 0;line-height:1.55}
        `}</style>
        <div className="ins-benefit" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </>
    );
  }

  // Plain text / hanya <br> — jadi bullet list
  const lines = html.split(/<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => {
        const clean = line
          .replace(/^Description:\s*/i, '')
          .replace(/^Travel type:\s*/i, '')
          .replace(/^Minimum age:\s*/i, '👶 Min Usia: ')
          .replace(/^Maximum age:\s*/i, '👴 Maks Usia: ')
          .replace(/^Age limits:\s*/i, '📋 ');
        return (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5 shrink-0 text-xs"></i>
            <span className="leading-relaxed">{clean}</span>
          </li>
        );
      })}
    </ul>
  );
}

function InsuranceCard({ product, onSelect, isSelecting, isCheapest = false }: {
  product: any;
  onSelect: (p: any) => void;
  isSelecting?: boolean;
  isCheapest?: boolean;
}) {
  const { language } = useLanguage();
  const t = i18n.insuranceSearch[language];
  const [showInfo, setShowInfo] = useState(false);

  const provider = product.provider || product.carrier_code || '';
  const badge    = PROVIDER_COLORS[provider] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', label: provider.toUpperCase() };
  const price    = product.total_price || 0;
  const info     = product.info || '';

  const summary  = product.service_charge_summary?.[0];
  const commission = Math.abs(summary?.total_commission || summary?.base_commission || 0);

  const limitTags = useMemo(() => {
    const tags: string[] = [];
    if (product.minPax != null && product.maxPax != null) tags.push(`${product.minPax}–${product.maxPax} peserta`);
    if (product.minAdultOld != null && product.maxAdultOld != null) tags.push(`Dewasa ${product.minAdultOld}–${product.maxAdultOld} thn`);
    if (product.minChildOld != null && product.maxChildOld != null) tags.push(`Anak ${product.minChildOld}–${product.maxChildOld} thn`);
    return tags;
  }, [product]);

  return (
    <div className={`bg-white rounded-2xl border shadow-card overflow-hidden hover:shadow-lg transition-all duration-200 group ${isCheapest ? 'border-orange-400 ring-2 ring-orange-400/30' : 'border-slate-100 hover:border-orange-200'}`}>
      {/* Provider Badge */}
      <div className={`px-5 pt-3 pb-0 flex items-center gap-2`}>
        {isCheapest && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-sm">
            <i className="fa-solid fa-tags text-[9px]"></i> Harga Termurah
          </span>
        )}
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
          {badge.label}
        </span>
        {product.sector_type && (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
            {product.sector_type}
          </span>
        )}
        {(product.type_trip_name || product.master_trip_id) && (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
            {product.type_trip_name || (product.master_trip_id === 'single_trip' ? 'Sekali Jalan' : 'Tahunan')}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col md:flex-row items-stretch gap-4">
        {/* Kiri: Ikon + Nama */}
        <div className="flex items-start gap-3 md:w-52 shrink-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${badge.bg} border ${badge.border}`}>
            <i className={`fa-solid fa-shield-halved text-xl ${badge.text}`}></i>
          </div>
          <div className="min-w-0">
            <p className="font-black text-brand-ink text-sm leading-snug">{product.product_name}</p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{product.product_code}</p>
            {product.data_name && (
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <i className="fa-solid fa-location-dot text-[9px]"></i> {product.data_name}
              </p>
            )}
          </div>
        </div>

        {/* Tengah: Limit & Info singkat */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          {limitTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {limitTags.map((t, i) => (
                <span key={i} className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Preview 2 baris info */}
          {info && !showInfo && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed"
               dangerouslySetInnerHTML={{
                 __html: sanitizeInsuranceHtml(
                   info
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s{2,}/g, ' ')
                     .trim()
                     .substring(0, 120) + (info.length > 120 ? '...' : '')
                 )
               }}
            />
          )}

          {/* Tombol toggle detail */}
          {info && (
            <button
              onClick={() => setShowInfo(v => !v)}
              className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 self-start"
            >
              <i className={`fa-solid fa-chevron-${showInfo ? 'up' : 'down'} text-[9px]`}></i>
              {showInfo ? 'Sembunyikan manfaat' : 'Lihat detail manfaat'}
            </button>
          )}
        </div>

        {/* Kanan: Harga + CTA */}
        <div className="md:w-48 shrink-0 flex flex-col items-start md:items-end justify-between pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <div className="md:text-right">
            <p className="text-[11px] text-slate-400 font-medium mb-0.5">{t.premium}</p>
            <p className="text-2xl font-black text-orange-600 leading-tight">
              {fmtIDR(price)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t.perPax} / IDR</p>
            {commission > 0 && (
              <p className="text-[10px] text-emerald-600 font-bold mt-1">
                Komisi: {fmtIDR(commission)}
              </p>
            )}
          </div>
          <button
            onClick={() => onSelect(product)}
            disabled={isSelecting}
            className="mt-3 md:mt-0 w-full md:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors text-sm shadow-sm group-hover:shadow-md"
          >
            {isSelecting ? (
              <span className="flex items-center gap-2 justify-center">
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Memproses...
              </span>
            ) : t.selectPlan}
          </button>
          {product.pdf && (
            <a href={product.pdf} target="_blank" rel="noopener noreferrer"
               className="text-[10px] text-slate-400 hover:text-orange-600 mt-1.5 flex items-center gap-1 transition-colors">
              <i className="fa-solid fa-file-pdf text-[9px]"></i> S&K Lengkap
            </a>
          )}
        </div>
      </div>

      {/* Detail Manfaat — expanded */}
      {showInfo && info && (
        <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
          <div className="pt-4">
            <InfoRenderer html={info} />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(InsuranceCard);