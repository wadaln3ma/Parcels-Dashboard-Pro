
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parcelId = Number(searchParams.get('parcelId') || '0');
  const distance = Number(searchParams.get('distance') || '0');
  if (!parcelId || !distance) return NextResponse.json({ error: 'parcelId and distance are required' }, { status: 400 });
  const sql = `WITH p AS (SELECT geom FROM parcels WHERE id = $1),
    b AS (SELECT ST_Buffer(geom::geography, $2)::geometry AS geom FROM p)
    SELECT (SELECT ST_AsGeoJSON(geom)::json FROM b) AS buffer,
      (SELECT jsonb_build_object('type','FeatureCollection','features', jsonb_agg(
        jsonb_build_object('type','Feature','properties', jsonb_build_object('id', id, 'owner', owner),'geometry', ST_AsGeoJSON(parcels.geom)::jsonb)))
       FROM parcels, b WHERE ST_Intersects(parcels.geom, b.geom)) AS intersects;`;
  try { const { rows } = await pool.query(sql, [parcelId, distance]); return NextResponse.json(rows?.[0] || {}); }
  catch (e) { return NextResponse.json({ error: 'DB error', detail: String(e) }, { status: 500 }); }
}
