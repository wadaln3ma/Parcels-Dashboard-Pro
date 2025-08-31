
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
export async function GET() {
  try {
    const { rows } = await pool.query('SELECT id, owner, ST_AsText(geom) AS wkt FROM parcels ORDER BY id');
    const header = 'id,owner,wkt\n';
    const body = rows.map(r => `${r.id},${JSON.stringify(r.owner)},${JSON.stringify(r.wkt)}`).join('\n');
    return new NextResponse(header + body, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="parcels.csv"' } });
  } catch (e) {
    const fc = (await import('@/data/parcels_sample.json')).default as any;
    const header = 'id,owner,geometry\n';
    const body = fc.features.map((f:any)=>`${f.properties.id},${JSON.stringify(f.properties.owner)},${JSON.stringify(JSON.stringify(f.geometry))}`).join('\n');
    return new NextResponse(header + body, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="parcels.csv"' } });
  }
}
