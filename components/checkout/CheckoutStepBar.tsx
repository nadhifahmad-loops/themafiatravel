'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

type SectionRef = { current: HTMLElement | null };

interface Props {
  /** Nama tiap langkah; jumlahnya harus sama dengan `sections`. */
  labels?: string[];
  /**
   * Ref section yang menjadi target scroll-spy. Diobservasi dengan
   * IntersectionObserver sehingga chip langkah aktif ikut mengikuti scroll.
   */
  sections?: SectionRef[];
  /**
   * Status isi FIELD WAJIB tiap langkah — `true` bila semua field wajib di
   * section itu sudah terisi. INI yang menentukan tanda ✓, bukan posisi scroll,
   * sehingga chip langsung hijau begitu field terisi dan kembali abu-abu bila
   * user mengosongkannya lagi. Langkah yang tidak disebut dianggap belum lengkap.
   */
  completed?: boolean[];
  /**
   * Penanda langkah yang TIDAK punya field wajib sama sekali (mis. "Pelengkap"
   * berisi bagasi/kursi/makan yang semuanya opsional). Karena tidak ada yang
   * bisa "diisi", ✓-nya diambil dari apakah section-nya sudah pernah dikunjungi.
   */
  optional?: boolean[];
  /** Judul halaman (opsional) — tampil di tengah bar. */
  title?: string;
  /** Subjudul (opsional), mis. nama produk/rute. */
  subtitle?: string;
  onBack?: () => void;
}

/**
 * BAR KEDUA checkout: tombol "← Kembali" di kiri, judul langkah di tengah,
 * dan stepper di kanan.
 *
 * Sticky di SEMUA ukuran layar (agar row langkah tetap terlihat saat scroll di
 * HP):
 *  - Desktop (`lg`): menempel tepat di bawah CheckoutNavbar (top-60px).
 *  - Mobile: menempel di puncak layar (top-0), sedangkan CheckoutNavbar hanya
 *    `lg:sticky` — bar brand ikut ter-scroll ke atas supaya bar atas di HP
 *    tetap ringan (±49px, malah lebih hemat dari sebelumnya) dan tidak
 *    menyita ruang membaca form. Tombol "← Kembali" ikut menempel.
 *
 * Dua sumber status yang BERBEDA, jangan tertukar:
 *  - `done` (hijau ✓)  → hasil isi form (`completed`); untuk langkah opsional,
 *    apakah section-nya sudah pernah dikunjungi (`visited`). Ini "pengecekan".
 *  - `active` (oranye) → posisi scroll sekarang, hanya sorotan "Anda di sini".
 * Prioritas tampilan: done > active > belum lengkap.
 */
export default function CheckoutStepBar({
  labels,
  sections,
  completed,
  optional,
  title,
  subtitle,
  onBack,
}: Props) {
  const { language } = useLanguage();
  const tc = i18n.common[language];
  const [active, setActive] = useState(0);
  // Section yang SUDAH PERNAH dilihat. Disimpan sebagai Set yang tidak pernah
  // dikurangi, sehingga ✓ pada langkah opsional tidak hilang saat user scroll
  // kembali ke atas (berbeda dengan `active` yang mengikuti posisi sekarang).
  const [visited, setVisited] = useState<Set<number>>(new Set());
  // Inset bar sticky di atas berbeda per breakpoint — dipakai scroll-spy.
  const [isDesktop, setIsDesktop] = useState(false);

  const showStepper =
    !!labels && !!sections && labels.length > 0 && labels.length === sections.length;

  // Status akhir tiap langkah: ✓ bila field wajib terisi, ATAU (untuk langkah
  // opsional) bila section-nya sudah pernah dikunjungi. Dihitung saat render
  // (tanpa useMemo) karena `validate()` di halaman hanya berisi puluhan cek
  // regex kecil — murah, dan hasilnya selalu sinkron dengan state form.
  const done = (labels ?? []).map((_, i) =>
    (completed?.[i] ?? false) || (!!optional?.[i] && visited.has(i))
  );

  // Besarnya inset bar di atas: HP hanya bar ini (±49px + beberapa px lega),
  // desktop bar brand (60px) + bar ini (±49px). Tanpa dipisah per breakpoint,
  // garis "aktif" di HP terlambat terbaca ±55px karena dua bar sudah tidak
  // menumpuk di sana.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!showStepper || !sections) return;
    const targets = sections.map(s => s.current).filter(Boolean) as HTMLElement[];
    if (targets.length < 2) return;

    const topInset = isDesktop ? 110 : 56;
    const indexOf = (el: Element) => sections.findIndex(s => s.current === el);

    // (1) Sorotan "Anda di sini": hanya area baca di bawah bar sticky, dengan
    //     60% bawah layar sengaja dikecualikan — langkah baru dianggap aktif
    //     ketika section-nya sudah benar-benar terbaca, bukan tertutup bar.
    const activeObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = indexOf(entry.target);
          if (idx !== -1) setActive(idx);
        });
      },
      { rootMargin: `-${topInset}px 0px -60% 0px`, threshold: 0 }
    );

    // (2) Penanda "sudah pernah dilihat" untuk langkah opsional. Observer (1)
    //     memotong 60% bawah layar sehingga section terakhir bisa terlewat bila
    //     halaman di-drag langsung ke bawah — maka pemantaunya dibuat longgar:
    //     cukup sebagian section terlihat di layar (hanya bar atas yang
    //     dikecualikan), tanpa batas bawah. Sekali tercatat, tidak pernah
    //     dihapus, supaya ✓ tidak hilang saat scroll kembali ke atas.
    const visitedObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = indexOf(entry.target);
          if (idx !== -1) setVisited(prev => (prev.has(idx) ? prev : new Set(prev).add(idx)));
        });
      },
      { rootMargin: `-${topInset}px 0px 0px 0px`, threshold: 0 }
    );

    targets.forEach(t => { activeObs.observe(t); visitedObs.observe(t); });
    return () => { activeObs.disconnect(); visitedObs.disconnect(); };
  }, [sections, showStepper, isDesktop]);

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 lg:top-[60px] z-10">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 shrink-0 -ml-2 px-2 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <span aria-hidden="true">←</span>
          <span>{tc.back}</span>
        </button>

        {title && (
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[13px] sm:text-sm font-bold text-slate-800 truncate leading-tight">{title}</p>
            {subtitle && (
              <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{subtitle}</p>
            )}
          </div>
        )}

        {showStepper ? (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {labels!.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5 sm:gap-2">
                {/* Garis menyala hanya bila kedua sisi sudah ✓ — mewakili
                    segmen yang benar-benar selesai, bukan sekadar posisi scroll */}
                {i > 0 && (
                  <div className={`w-3 sm:w-4 h-px ${done[i - 1] && done[i] ? 'bg-orange-400' : 'bg-slate-200'}`} />
                )}
                <button
                  type="button"
                  aria-current={i === active ? 'step' : undefined}
                  aria-label={`${i + 1}. ${labels![i]}${done[i] ? ' ✓' : ''}`}
                  onClick={() =>
                    sections![i].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                    done[i]
                      ? 'bg-emerald-50 text-emerald-600'
                      : i === active
                      ? 'bg-orange-50 text-orange-600'
                      : 'text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                      done[i]
                        ? 'bg-emerald-500 text-white'
                        : i === active
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {done[i] ? '✓' : i + 1}
                  </span>
                  {/* Label hanya di layar lebar agar chip tidak memadat di HP */}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          title && <div className="w-8 sm:w-16 shrink-0" />
        )}
      </div>
    </div>
  );
}
