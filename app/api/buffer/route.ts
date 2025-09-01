import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parcelId = Number(searchParams.get('parcelId') || '');
    const distance = Number(searchParams.get('distance') || '0'); // meters

    if (!parcelId || Number.isNaN(parcelId)) {
      return NextResponse.json({ error: 'parcelId required' }, { status: 400 });
    }

    const sql = `
      WITH target AS (SELECT geom FROM parcels WHERE id = $1),
      buf AS (SELECT ST_Buffer(geom::geography, $2)::geometry AS g FROM target),
      hits AS (
        SELECT p.id, p.owner, ST_AsGeoJSON(p.geom)::json AS geom
        FROM parcels p, buf b
        WHERE ST_Intersects(p.geom, b.g)
      )
      SELECT
        (SELECT ST_AsGeoJSON(g)::json FROM buf) AS buffer,
        (SELECT json_agg(json_build_object(
          'type','Feature',
          'properties', json_build_object('id', id, 'owner', owner),
          'geometry', geom
        )) FROM hits) AS features
    `;
    const { rows } = await pool.query(sql, [parcelId, distance]);
    const row = rows[0] || {};
    const buffer = row.buffer || null;
    const features = row.features || [];

    return NextResponse.json({
      buffer: buffer ? { type: 'Feature', properties: {}, geometry: buffer } : null,
      intersects: { type: 'FeatureCollection', features },
    });
  } catch {
    return NextResponse.json({ buffer: null, intersects: { type: 'FeatureCollection', features: [] } });
  }
}
