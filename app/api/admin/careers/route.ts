import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const careers = await prisma.career.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ careers });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const admin = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  });
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { title, department, type, location, description, requirements, sortOrder, isActive } = body;

  if (!title || !department || !location || !description) {
    return NextResponse.json({ error: 'Judul, divisi, lokasi, dan deskripsi wajib diisi.' }, { status: 400 });
  }

  const career = await prisma.career.create({
    data: {
      title,
      department,
      type: type || 'full-time',
      location,
      description,
      requirements: requirements || '',
      sortOrder: sortOrder || 0,
      isActive: isActive !== false,
    },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'career.create',
    entityType: 'career',
    entityId: career.id,
    after: career,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, career });
}
