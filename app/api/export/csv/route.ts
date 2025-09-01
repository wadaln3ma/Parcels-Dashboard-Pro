import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

type ParcelRow = { id: number; owner: string | null; wkt: string };

export const dynamic = 'force-dynamic';

export async function GET(_req: Request) {
  try {
    const { rows } = await pool.query<ParcelRow>(
      'SELECT id, owner, ST_AsText(geom) AS wkt FROM parcels ORDER BY id'
    );
    const header = 'id,owner,wkt\n';
    const body = rows
      .map((r: ParcelRow) => `${r.id},${JSON.stringify(r.owner ?? '')},${JSON.stringify(r.wkt)}`)
      .join('\n');
    return new NextResponse(header + body, {
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="parcels.csv"',
      },
    });
  } catch {
    const fc = (await import('@/data/parcels_sample.json')).default as any;
    const header = 'id,owner,geometry\n';
    const body = (fc.features || [])
      .map(
        (f: any) =>
          `${f.properties?.id},${JSON.stringify(f.properties?.owner ?? '')},${JSON.stringify(
            JSON.stringify(f.geometry)
          )}`
      )
      .join('\n');
    return new NextResponse(header + body, {
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="parcels.csv"',
      },
    });
  }
}
