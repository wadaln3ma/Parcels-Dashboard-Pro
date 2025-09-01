import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const r = await pool.query('select now() as now');
    return NextResponse.json({
      ok: true,
      db: 'connected',
      now: r.rows?.[0]?.now ?? null,
      ssl: !!process.env.PGSSL,
      host: process.env.PGHOST || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db: 'error', error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
