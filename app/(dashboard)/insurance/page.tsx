'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InsurancePage() {
  const router = useRouter();
  useEffect(() => { router.replace('/insurance/search'); }, [router]);
  return (
    <div className="flex items-center justify-center h-screen bg-[#f4f6fb]">
      <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );
}