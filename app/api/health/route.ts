import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const now = await pool.query('select now() as now');
    const ext = await pool.query("select extversion from pg_extension where extname='postgis'");
    const ver = await pool.query('select postgis_full_version() as ver').catch(()=>({ rows:[{ ver: null }]}));

    // table exists?
    const reg = await pool.query("select to_regclass('public.parcels') as rel");
    // one sample SRID if any
    const sr = await pool.query('select ST_SRID(geom) as srid from parcels limit 1').catch(()=>({ rows:[{ srid: null }] }));

    return NextResponse.json({
      ok: true,
      db: 'connected',
      now: now.rows?.[0]?.now ?? null,
      postgis: !!ext.rows?.length,
      postgis_version: ver.rows?.[0]?.ver ?? null,
      parcels_table: reg.rows?.[0]?.rel ?? null,
      sample_srid: sr.rows?.[0]?.srid ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, db: 'error', error: e?.message || String(e) }, { status: 500 });
  }
}
