// types/turf.d.ts

// --- @turf/length ---
declare module '@turf/length' {
    import type {
      Feature, FeatureCollection,
      LineString, MultiLineString, Polygon, MultiPolygon
    } from 'geojson';
  
    type LengthInput =
      | Feature<LineString | MultiLineString | Polygon | MultiPolygon>
      | FeatureCollection<LineString | MultiLineString | Polygon | MultiPolygon>;
  
    const length: (
      input: LengthInput,
      options?: { units?: 'degrees' | 'radians' | 'miles' | 'kilometers' }
    ) => number;
  
    export default length;
  }
  
  // --- @turf/polygon-to-line ---
  declare module '@turf/polygon-to-line' {
    import type {
      Feature, FeatureCollection,
      Polygon, MultiPolygon, LineString, MultiLineString
    } from 'geojson';
  
    const polygonToLine: (
      poly: Feature<Polygon | MultiPolygon> | Polygon | MultiPolygon
    ) => Feature<LineString | MultiLineString> | FeatureCollection<LineString | MultiLineString>;
  
    export default polygonToLine;
  }
  
  // (Optional) if your editor ever flags @turf/area
  declare module '@turf/area' {
    const area: (g: any) => number;
    export default area;
  }
  