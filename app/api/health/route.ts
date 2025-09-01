// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';   // don't prerender
export const runtime = 'nodejs';          // ensure Node runtime (not Edge)

export async function GET() {
  try {
    // Simple DB ping
    const r = await pool.query('select now() as now');
    return NextResponse.json({
      ok: true,
      db: 'connected',
      now: r.rows?.[0]?.now ?? null,
      ssl: !!process.env.PGSSL,
      via: process.env.DATABASE_URL ? 'DATABASE_URL' : 'PG split vars',
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db: 'error', error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
