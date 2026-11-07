'use client';

import { useAuthModal } from '@/contexts/AuthModalContext';
import LoginModal from '@/components/auth/LoginModal';
import RegisterModal from '@/components/auth/RegisterModal';
import LoginSuccessModal from '@/components/auth/LoginSuccessModal';

// Titik mount tunggal untuk semua modal autentikasi.
export default function AuthModals() {
  const { mode } = useAuthModal();

  return (
    <>
      {mode === 'login' && <LoginModal />}
      {mode === 'register' && <RegisterModal />}
      <LoginSuccessModal />
    </>
  );
}
