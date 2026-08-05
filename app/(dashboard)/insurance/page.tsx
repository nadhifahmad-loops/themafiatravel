'use client';
import { useEffect } from 'react';

export default function InsurancePage() {
  useEffect(() => {
    window.location.replace('/insurance/search');
  }, []);
  return (
    <div className="flex items-center justify-center h-screen bg-[#f4f6fb]">
      <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );
}