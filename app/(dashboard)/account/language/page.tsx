'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Toast } from '../edit/components';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

const ANIM_CSS = `
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .edit-anim { animation: slideUp 0.45s ease forwards; opacity: 0; }
`;

const LANGUAGES = [
  { code: 'ID' as const, label: 'Bahasa Indonesia' },
  { code: 'EN' as const, label: 'English' },
];

export default function LanguagePage() {
  const { status } = useSession();
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const ta = i18n.account[language];

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return; }
  }, [status, router]);

  const handleSelect = (code: 'ID' | 'EN') => {
    if (code === language) return;
    setLanguage(code);
    setToast({ type: 'success', text: ta.language.successMsg });
    setTimeout(() => router.back(), 1000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb' }}>
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />
      {toast && <Toast key={`${toast.type}-${toast.text}`} message={toast.text} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '112px 16px 64px' }}>

        {/* Header */}
        <div className="edit-anim" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <button onClick={() => router.back()} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: '13px', color: '#64748b' }}></i>
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{ta.language.title}</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0', fontWeight: 500 }}>{ta.language.subtitle}</p>
        </div>

        {/* Language Options */}
        <div className="edit-anim" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <div style={{ padding: '20px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-globe" style={{ color: '#ea580c', fontSize: '14px' }}></i>
            </div>
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>{ta.language.title}</span>
          </div>
          <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {LANGUAGES.map(l => {
              const active = language === l.code;
              return (
                <button key={l.code} onClick={() => handleSelect(l.code)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', padding: '18px 20px', borderRadius: '16px', border: `2px solid ${active ? '#ea580c' : '#e2e8f0'}`, background: active ? '#fff7ed' : '#f8fafc', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                  <Image src={l.code === 'ID' ? '/images/flags/ID.png' : '/images/flags/GB.png'} alt="" width={38} height={28} style={{ minWidth: '38px', height: '28px', objectFit: 'cover', borderRadius: '7px', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }} />
                  <span style={{ minWidth: '38px', height: '28px', padding: '0 10px', borderRadius: '9px', background: active ? '#ea580c' : '#e2e8f0', color: active ? 'white' : '#64748b', fontWeight: 900, fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{l.code}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: active ? '#ea580c' : '#0f172a' }}>{l.label}</span>
                  {active && <i className="fa-solid fa-circle-check" style={{ color: '#ea580c', fontSize: '18px' }}></i>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
