'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parsePhoneWithCode } from '../edit/components';
import { useLanguage } from '@/contexts/LanguageContext';
import { i18n } from '@/lib/i18n';

const ANIM_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeInDown { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .detail-anim { animation: slideUp 0.45s ease forwards; opacity: 0; }
  .detail-anim:nth-child(1) { animation-delay: 0s; }
  .detail-anim:nth-child(2) { animation-delay: 0.07s; }
`;

function InfoRow({ label, value, icon, color, href, delay }: {
  label: string; value: string; icon: string; color: string; href?: string; delay: number;
}) {
  const row = (
    <div className="detail-anim" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', cursor: href ? 'pointer' : 'default', transition: 'background 0.15s', animationDelay: `${delay}s` }}
      onMouseEnter={e => { if (href) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (href) e.currentTarget.style.background = 'transparent'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fa-solid ${icon}`} style={{ color, fontSize: '15px' }}></i>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{label}</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '3px 0 0' }}>{value || '—'}</p>
        </div>
      </div>
      {href && <i className="fa-solid fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '12px' }}></i>}
    </div>
  );

  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{row}</Link> : row;
}

export default function AccountDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const ta = i18n.account[language];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('62');
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
        setName(data.user.name || '');
        setEmail(data.user.email || '');
        setPhone(number);
        setPhoneCode(code);
        setLoaded(true);
      } catch (err) {
        console.error('[Account Detail]', err);
        setLoaded(true);
      }
    }
    load();
  }, [status, session?.user?.email]);

  const displayPhone = phone ? `+${phoneCode} ${phone}` : 'Belum ditambahkan';

  if (status === 'loading' || !loaded) return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#EA580C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb' }}>
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '112px 16px 64px' }}>

        {/* Header */}
        <div className="detail-anim" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <button onClick={() => router.back()} style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#ea580c'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: '13px', color: '#64748b' }}></i>
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{ta.profile.title}</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0', fontWeight: 500 }}>Lihat dan kelola informasi akun kamu</p>
        </div>

        {/* Info Rows */}
        <div className="detail-anim" style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <InfoRow label={ta.profile.nameLabel} value={name} icon="fa-user" color="#3b82f6" href="/account/edit/name" delay={0.12} />
          <div style={{ height: '1px', background: '#f1f5f9', margin: '0 32px' }} />
          <InfoRow label={ta.profile.emailLabel} value={email} icon="fa-envelope" color="#10b981" delay={0.18} />
          <div style={{ height: '1px', background: '#f1f5f9', margin: '0 32px' }} />
          <InfoRow label={ta.profile.phoneLabel} value={displayPhone} icon="fa-phone" color="#8b5cf6" href="/account/edit/phone" delay={0.24} />
        </div>

      </div>
    </div>
  );
}
