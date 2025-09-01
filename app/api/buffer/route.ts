import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parcelId = Number(searchParams.get('parcelId') || '');
  const distance = Number(searchParams.get('distance') || '0'); // meters

  if (!parcelId || Number.isNaN(parcelId)) {
    return NextResponse.json({ error: 'parcelId required' }, { status: 400 });
  }

  try {
    // 1) fetch the target geom first
    const tgt = await pool.query('SELECT geom FROM public.parcels WHERE id = $1', [parcelId]);
    if (!tgt.rows.length) {
      return NextResponse.json(
        { error: `parcel ${parcelId} not found`, buffer: null, intersects: { type:'FeatureCollection', features: [] } },
        { status: 404 }
      );
    }

    // 2) run buffer + intersects
    const sql = `
      WITH buf AS (
        SELECT ST_Buffer(($1)::geography, $2)::geometry AS g
      ),
      hits AS (
        SELECT p.id, p.owner, ST_AsGeoJSON(p.geom)::json AS geom
        FROM public.parcels p, buf b
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
    const { rows } = await pool.query(sql, [tgt.rows[0].geom, distance]);
    const row = rows[0] || {};
    const buffer = row.buffer || null;
    const features = row.features || [];

    return NextResponse.json({
      buffer: buffer ? { type: 'Feature', properties: {}, geometry: buffer } : null,
      intersects: { type: 'FeatureCollection', features },
    });
  } catch (e: any) {
    return new NextResponse(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
