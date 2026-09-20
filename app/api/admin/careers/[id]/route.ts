import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit, auditIpFromRequest } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const career = await prisma.career.findUnique({ where: { id } });
  if (!career) {
    return NextResponse.json({ error: 'Lowongan tidak ditemukan.' }, { status: 404 });
  }

  return NextResponse.json({ career });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const existing = await prisma.career.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Lowongan tidak ditemukan.' }, { status: 404 });
  }

  const body = await req.json();
  const { title, department, type, location, description, requirements, sortOrder, isActive } = body;

  if (!title || !department || !location || !description) {
    return NextResponse.json({ error: 'Judul, divisi, lokasi, dan deskripsi wajib diisi.' }, { status: 400 });
  }

  const career = await prisma.career.update({
    where: { id },
    data: {
      title,
      department,
      type: type || 'full-time',
      location,
      description,
      requirements: requirements || '',
      sortOrder: sortOrder ?? 0,
      isActive: isActive !== false,
    },
  });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'career.update',
    entityType: 'career',
    entityId: career.id,
    before: existing,
    after: career,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true, career });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const existing = await prisma.career.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Lowongan tidak ditemukan.' }, { status: 404 });
  }

  await prisma.career.delete({ where: { id } });

  await recordAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'career.delete',
    entityType: 'career',
    entityId: existing.id,
    before: existing,
    ip: auditIpFromRequest(req),
  });

  return NextResponse.json({ success: true });
}
