import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const via = process.env.DATABASE_URL ? 'DATABASE_URL' : 'PG split vars';
  const host = process.env.DATABASE_URL
    ? (() => { try { return new URL(process.env.DATABASE_URL!).hostname; } catch { return null; } })()
    : (process.env.PGHOST || null);

  if (!host) return NextResponse.json({ ok: false, error: 'no host' }, { status: 400 });

  try {
    const addr = await lookup(host, { all: true });
    return NextResponse.json({ ok: true, via, host, resolved: addr });
  } catch (e: any) {
    return NextResponse.json({ ok: false, via, host, error: e?.message || String(e) }, { status: 500 });
  }
}
