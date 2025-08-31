
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
export async function GET() {
  try {
    const sql = `SELECT jsonb_build_object('type','FeatureCollection','features', jsonb_agg(
      jsonb_build_object('type','Feature','properties', jsonb_build_object('id', id, 'owner', owner),'geometry', ST_AsGeoJSON(geom)::jsonb))) AS fc FROM parcels;`;
    const { rows } = await pool.query(sql);
    if (rows?.[0]?.fc) return NextResponse.json(rows[0].fc);
  } catch {}
  const fc = await import('@/data/parcels_sample.json');
  return NextResponse.json(fc.default || fc);
}
