import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req?: Request) {
  try {
    const url = (req && typeof req.url === 'string') ? req.url : 'http://localhost/';
    const u = new URL(url, 'http://localhost'); // base guards against relative URLs
    const text = (u.searchParams.get('text') || '').trim();

    if (!text) {
      const fc = (await import('@/data/parcels_sample.json')).default as any;
      return NextResponse.json(fc);
    }

    const sql = `
      SELECT id, owner, ST_AsGeoJSON(geom)::json AS geometry
      FROM parcels
      WHERE CAST(id AS TEXT) ILIKE $1 OR owner ILIKE $1
      ORDER BY id
      LIMIT 50
    `;
    const { rows } = await pool.query(sql, [`%${text}%`]);

    if (!rows.length) {
      const fc = (await import('@/data/parcels_sample.json')).default as any;
      const filtered = {
        type: 'FeatureCollection',
        features: (fc.features || []).filter(
          (f: any) =>
            String(f.properties?.id).includes(text) ||
            (f.properties?.owner || '').toLowerCase().includes(text.toLowerCase())
        ),
      };
      return NextResponse.json(filtered);
    }

    const features = rows.map((r: any) => ({
      type: 'Feature',
      properties: { id: r.id, owner: r.owner },
      geometry: r.geometry,
    }));
    return NextResponse.json({ type: 'FeatureCollection', features });
  } catch {
    const fc = (await import('@/data/parcels_sample.json')).default as any;
    return NextResponse.json(fc);
  }
}
