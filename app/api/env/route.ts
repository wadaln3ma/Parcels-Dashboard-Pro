import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const via = process.env.DATABASE_URL ? 'DATABASE_URL' : 'PG split vars';

  let hostFromUrl: string | null = null;
  try { hostFromUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null; } catch {}

  return NextResponse.json({
    via,
    PGHOST: (process.env.PGHOST || null),
    hostFromUrl,
    ssl: !!process.env.PGSSL,
    note: 'No secrets shown; this only echoes hostnames and flags.',
  });
}
