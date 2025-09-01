import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Normalize any GeoJSON payload to a single Geometry (or GeometryCollection)
function normalizeToGeometry(input: any): any | null {
  if (!input) return null;

  // Feature -> use its geometry
  if (input.type === 'Feature' && input.geometry) return input.geometry;

  // FeatureCollection -> pack into a GeometryCollection
  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    const geoms = input.features.map((f: any) => f?.geometry).filter(Boolean);
    if (geoms.length === 1) return geoms[0];
    if (geoms.length > 1) return { type: 'GeometryCollection', geometries: geoms };
    return null;
  }

  // Bare geometry
  if (input.type && input.coordinates) return input;

  return null;
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const distance = Number(searchParams.get('distance') || '0'); // meters

    let body: any = null;
    try { body = await req.json(); } catch { body = null; }

    const geom = normalizeToGeometry(body);
    if (!geom) {
      // No usable geometry -> empty result (not a 500)
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
    }

    // Buffer AOI (on a sphere) then intersect parcels
    const sql = `
      WITH aoi AS (
        SELECT ST_Buffer(
          ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography,
          $2
        )::geometry AS geom
      )
      SELECT json_build_object(
        'type','FeatureCollection',
        'features', COALESCE(json_agg(json_build_object(
          'type','Feature',
          'properties', json_build_object('id', p.id, 'owner', p.owner),
          'geometry', ST_AsGeoJSON(p.geom)::json
        )), '[]'::json)
      ) AS fc
      FROM public.parcels p, aoi
      WHERE ST_Intersects(p.geom, aoi.geom)
    `;

    const { rows } = await pool.query(sql, [JSON.stringify(geom), distance]);
    const fc = rows[0]?.fc || { type: 'FeatureCollection', features: [] };
    return NextResponse.json(fc);
  } catch (e: any) {
    // Return error text so the client can show it
    return new NextResponse(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
