import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const distance = Number(searchParams.get('distance') || '0'); // meters

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    if (!body) {
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
    }

    const sql = `
      WITH aoi AS (
        SELECT ST_Buffer(ST_GeomFromGeoJSON($1)::geography, $2)::geometry AS geom
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
    const { rows } = await pool.query(sql, [JSON.stringify(body), distance]);
    const fc = rows[0]?.fc || { type: 'FeatureCollection', features: [] };
    return NextResponse.json(fc);
  } catch (e: any) {
    return new NextResponse(
      JSON.stringify({ type: 'FeatureCollection', features: [], error: e?.message || String(e) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
