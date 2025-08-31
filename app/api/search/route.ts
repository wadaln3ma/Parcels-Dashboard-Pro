
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get('text') || '').trim();
  if (!text) return NextResponse.json({ type: 'FeatureCollection', features: [] });
  try {
    const sql = `SELECT jsonb_build_object('type','FeatureCollection','features', jsonb_agg(
      jsonb_build_object('type','Feature','properties', jsonb_build_object('id', id, 'owner', owner),'geometry', ST_AsGeoJSON(geom)::jsonb))) AS fc
      FROM parcels WHERE CAST(id AS TEXT) ILIKE '%'||$1||'%' OR owner ILIKE '%'||$1||'%';`;
    const { rows } = await pool.query(sql, [text]);
    return NextResponse.json(rows?.[0]?.fc || { type: 'FeatureCollection', features: [] });
  } catch { return NextResponse.json({ type: 'FeatureCollection', features: [] }); }
}
