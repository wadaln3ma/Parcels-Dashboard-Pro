// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request) {
  try {
    const r = await pool.query('select now() as now');
    return NextResponse.json({
      ok: true,
      db: 'connected',
      now: r.rows?.[0]?.now ?? null,
      ssl: !!process.env.PGSSL,
      host: process.env.PGHOST || (process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db: 'error', error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
