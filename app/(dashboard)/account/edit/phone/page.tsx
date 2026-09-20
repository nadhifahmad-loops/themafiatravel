'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { parsePhoneWithCode, CountryCodeSelect, PhoneVerifyModal, Toast } from '../components';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

const ANIM_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .edit-anim { animation: slideUp 0.45s ease forwards; opacity: 0; }
`;

export default function EditPhonePage() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const tc = i18n.common[language];

  const [phone, setPhone] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('62');
  const [originalPhoneCode, setOriginalPhoneCode] = useState('62');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return; }
  }, [status, router]);

  useEffect(() => {
    async function load() {
      if (status !== 'authenticated' || !session?.user?.email) return;
      try {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const rawPhone = data.user.phone || '';
        const { code, number } = parsePhoneWithCode(rawPhone);
        setPhone(number);
        setOriginalPhone(number);
        setPhoneCode(code);
        setOriginalPhoneCode(code);
        setLoaded(true);
      } catch { setLoaded(true); }
    }
    load();
  }, [status, session?.user?.email]);

  const isDirty = phone !== originalPhone || phoneCode !== originalPhoneCode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    setShowPhoneVerify(true);
  };

  if (status === 'loading' || !loaded) return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#EA580C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb' }}>
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />
      {toast && <Toast key={`${toast.type}-${toast.text}`} message={toast.text} type={toast.type} onClose={() => setToast(null)} />}
      {showPhoneVerify && (
        <PhoneVerifyModal phone={phone} phoneCode={phoneCode}
          onSuccess={async () => {
            setShowPhoneVerify(false);
            const updatedFullPhone = `${phoneCode}${phone}`;
            try {
              await update({ ...session, user: { ...(session?.user ?? {}), phone: updatedFullPhone } });
              setOriginalPhone(phone);
              setOriginalPhoneCode(phoneCode);
              setToast({ type: 'success', text: ta.profile.successMsg });
              setTimeout(() => router.push('/account/detail'), 1200);
            } catch {
              setOriginalPhone(phone);
              setOriginalPhoneCode(phoneCode);
              setToast({ type: 'success', text: ta.profile.successMsg });
              setTimeout(() => router.push('/account/detail'), 1200);
            }
          }}
          onClose={() => setShowPhoneVerify(false)}
        />
      )}

      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '112px 16px 64px' }}>

        {/* Header */}
        <div className="edit-anim" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <button onClick={() => router.back()} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: '13px', color: '#64748b' }}></i>
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Ubah Nomor Telepon</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0', fontWeight: 500 }}>Perbarui nomor telepon kamu</p>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit}>
          <div className="edit-anim" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <div style={{ padding: '20px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-phone" style={{ color: '#8b5cf6', fontSize: '14px' }}></i>
              </div>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>{ta.profile.phoneLabel}</span>
            </div>
            <div style={{ padding: '20px 32px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '8px', fontWeight: 700 }}>{ta.profile.phoneLabel}</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <CountryCodeSelect value={phoneCode} onChange={code => setPhoneCode(code)} dropdownId="cc-phone-edit" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  style={{ flex: 1, padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#f8fafc', transition: 'all 0.2s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = 'white'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                  placeholder="8123456789" />
              </div>
              {isDirty && (
                <p style={{ fontSize: '12px', color: '#d97706', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                  <i className="fa-solid fa-circle-info" style={{ fontSize: '11px' }}></i> Verifikasi OTP via WhatsApp diperlukan
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="edit-anim" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', animationDelay: '0.12s' }}>
            <button type="button" onClick={() => router.back()}
              style={{ padding: '14px 28px', background: 'white', color: '#475569', fontWeight: 700, borderRadius: '14px', border: '2px solid #e2e8f0', fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}>{tc.cancel}</button>
            <button type="submit" disabled={loading || !isDirty}
              style={{ padding: '14px 32px', background: !loading && isDirty ? '#ea580c' : '#e2e8f0', color: !loading && isDirty ? 'white' : '#94a3b8', fontWeight: 800, borderRadius: '14px', border: 'none', fontSize: '14px', cursor: !loading && isDirty ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: !loading && isDirty ? '0 4px 14px rgba(234,88,12,0.25)' : 'none', transition: 'all 0.15s' }}>
              {loading ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div> : <><i className="fa-solid fa-check" style={{ fontSize: '13px' }}></i> {tc.save}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
