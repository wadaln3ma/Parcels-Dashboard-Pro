import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const via = process.env.DATABASE_URL ? 'DATABASE_URL' : 'PG split vars';

  const rawHost = process.env.PGHOST ?? null;
  const trimmed = rawHost ? rawHost.trim() : null;

  let hostFromUrl: string | null = null;
  try { hostFromUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null; } catch {}

  return NextResponse.json({
    via,
    PGHOST_raw: rawHost,
    PGHOST_trimmed: trimmed,
    PGHOST_changed_by_trim: rawHost ? rawHost !== trimmed : null,
    PGHOST_charCodes: rawHost ? Array.from(rawHost).map(c => c.charCodeAt(0)) : null,
    hostFromUrl,
    ssl: !!process.env.PGSSL,
    note: 'If PGHOST_changed_by_trim is true, remove hidden whitespace in Vercel env.',
  });
}
