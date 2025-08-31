
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const distance = Number(url.searchParams.get('distance') || '0');
  const aoi = await req.json();
  try {
    const geomJson = JSON.stringify(aoi.features?.[0]?.geometry || aoi.geometry || aoi);
    const sql = distance > 0 ? `WITH aoi AS (
        SELECT ST_Buffer(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)::geography, $2)::geometry AS geom)
      SELECT jsonb_build_object('type','FeatureCollection','features', jsonb_agg(
        jsonb_build_object('type','Feature','properties', jsonb_build_object('id', id, 'owner', owner),'geometry', ST_AsGeoJSON(p.geom)::jsonb))) as fc
      FROM parcels p, aoi WHERE ST_Intersects(p.geom, aoi.geom);`
      : `WITH aoi AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom)
      SELECT jsonb_build_object('type','FeatureCollection','features', jsonb_agg(
        jsonb_build_object('type','Feature','properties', jsonb_build_object('id', id, 'owner', owner),'geometry', ST_AsGeoJSON(p.geom)::jsonb))) as fc
      FROM parcels p, aoi WHERE ST_Intersects(p.geom, aoi.geom);`;
    const params: any[] = [geomJson]; if (distance > 0) params.push(distance);
    const { rows } = await pool.query(sql, params);
    if (rows?.[0]?.fc) return NextResponse.json(rows[0].fc);
  } catch {}
  const fc = (await import('@/data/parcels_sample.json')).default as any;
  function bboxOfGeom(g:any){const xs:number[]=[], ys:number[]=[]; const col=(c:any)=>Array.isArray(c[0])?c.forEach(col):(xs.push(c[0]),ys.push(c[1])); col(g.coordinates); return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}
  const g = aoi.features?.[0]?.geometry || aoi.geometry || aoi;
  const [xmin,ymin,xmax,ymax] = bboxOfGeom(g);
  const out = fc.features.filter((f:any)=>{const [fxmin,fymin,fxmax,fymax] = bboxOfGeom(f.geometry); return !(fxmax < xmin || fxmin > xmax || fymax < ymin || fymin > ymax);});
  return NextResponse.json({ type:'FeatureCollection', features: out });
}
