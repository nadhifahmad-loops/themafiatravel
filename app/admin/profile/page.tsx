import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = { title: 'Profil Admin' };

export default async function ProfilePage() {
  // Mengambil data session secara aman dari sisi server
  const session = await getServerSession(authOptions);
  
  return <ProfileClient user={session?.user ?? null} />;
}