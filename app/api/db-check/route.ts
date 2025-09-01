import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = await pool.query('select now() as now');
    const postgis = await pool
      .query("select extversion from pg_extension where extname='postgis'")
      .then(r => !!r.rows.length)
      .catch(() => false);

    // Does the table exist?
    const reg = await pool
      .query("select to_regclass('public.parcels') as rel")
      .then(r => r.rows?.[0]?.rel || null);

    // Simple counts if it exists
    let stats: any = null;
    if (reg) {
      stats = await pool
        .query('select count(*)::int as n, min(id) as min_id, max(id) as max_id from public.parcels')
        .then(r => r.rows?.[0] || null);
    }

    return NextResponse.json({
      ok: true,
      now: now.rows?.[0]?.now ?? null,
      postgis,
      parcels_table: reg,
      stats,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
