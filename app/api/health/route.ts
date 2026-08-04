import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};
  const startTime = Date.now();

  // Database check
  let dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart };
  }

  // Orbisway check
  checks.orbisway = { status: process.env.ORBISWAY_BASE_URL ? 'configured' : 'not_configured' };

  // Midtrans check
  checks.midtrans = {
    status: process.env.MIDTRANS_SERVER_KEY ? 'configured' : 'not_configured',
  };

  const totalLatency = Date.now() - startTime;
  const allOk = Object.values(checks).every(c => c.status === 'ok' || c.status === 'configured');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks,
    latencyMs: totalLatency,
  }, { status: allOk ? 200 : 503 });
}
