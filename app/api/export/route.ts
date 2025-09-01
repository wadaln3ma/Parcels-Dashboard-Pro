import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request) {
  try {
    const { rows } = await pool.query(
      'SELECT id, owner, ST_AsGeoJSON(geom)::json AS geometry FROM parcels ORDER BY id'
    );
    const features = rows.map((r: any) => ({
      type: 'Feature',
      properties: { id: r.id, owner: r.owner },
      geometry: r.geometry,
    }));
    return new NextResponse(JSON.stringify({ type: 'FeatureCollection', features }), {
      headers: {
        'content-type': 'application/geo+json',
        'content-disposition': 'attachment; filename="parcels.geojson"',
      },
    });
  } catch {
    const fc = (await import('@/data/parcels_sample.json')).default as any;
    return new NextResponse(JSON.stringify(fc), {
      headers: {
        'content-type': 'application/geo+json',
        'content-disposition': 'attachment; filename="parcels.geojson"',
      },
    });
  }
}
