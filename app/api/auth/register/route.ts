import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }
    const user = await registerUser(name, email, password, phone);
    return NextResponse.json({ success: true, user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
