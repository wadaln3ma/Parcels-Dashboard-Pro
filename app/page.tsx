'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import area from '@turf/area';
import length from '@turf/length';
import polygonToLine from '@turf/polygon-to-line';
import { Search, Layers, Ruler, FileDown, Download, Map as MapIcon, SunMoon, Target } from 'lucide-react';

type Feature = GeoJSON.Feature<GeoJSON.Geometry, any>;
type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, any>;

function useLeafletState() {
  const mapRef = useRef<any>(null);
  const parcelLayerRef = useRef<any>(null);
  const selectionRef = useRef<any>(null);
  const bufferRef = useRef<any>(null);
  return { mapRef, parcelLayerRef, selectionRef, bufferRef };
}

export default function Home() {
  const { mapRef, parcelLayerRef, selectionRef, bufferRef } = useLeafletState();
  const mapDivRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // holds the Leaflet module once loaded (SSR-safe)
  const LRef = useRef<any>(null);
  const leafletDrawLoadedRef = useRef(false);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [bufferDist, setBufferDist] = useState(100);
  const [aoiBufferDist, setAoiBufferDist] = useState(0);
  const [status, setStatus] = useState('');
  const [basemap, setBasemap] = useState<'osm'|'carto'|'carto-dark'|'esri'|'hybrid'>('osm');
  const [dark, setDark] = useState(false);
  const [locating, setLocating] = useState(false);

  const roadsRef = useRef<any>(null);
  const zoningRef = useRef<any>(null);
  const [showRoads, setShowRoads] = useState(true);
  const [showZoning, setShowZoning] = useState(true);

  const aoiRef = useRef<any>(null);
  const [tableFeatures, setTableFeatures] = useState<FeatureCollection>({ type:'FeatureCollection', features: [] });

  // ---------- helpers to load libs only in browser ----------
  async function ensureLeaflet() {
    if (!LRef.current) {
      const mod = await import('leaflet');
      // Some bundlers export as default, some as module—support both
      LRef.current = (mod as any).default || mod;
    }
    return LRef.current;
  }

  async function ensureLeafletDraw() {
    await ensureLeaflet();
    if (!leafletDrawLoadedRef.current) {
      await import('leaflet-draw'); // augments L with Draw controls
      leafletDrawLoadedRef.current = true;
    }
  }

  // ---------- Dark mode sync ----------
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    if (dark && basemap === 'carto') setBasemapLayer('carto-dark');
    if (!dark && basemap === 'carto-dark') setBasemapLayer('carto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  // ---------- Map init ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapDivRef.current || mapRef.current) return;

      const L = await ensureLeaflet();
      const map = L.map(mapDivRef.current, { zoomControl: false }).setView([24.7136, 46.6753], 12);
      mapRef.current = map;

      L.control.zoom({ position: 'topright' }).addTo(map);
      L.control.scale({ metric: true, imperial: false }).addTo(map);

      (map as any)._currentBase = getBasemapLayer('osm')?.addTo(map);

      // Leaflet Draw (lazy)
      await ensureLeafletDraw();
      if (cancelled || !mapRef.current) return;

      const drawn = new L.FeatureGroup();
      map.addLayer(drawn);
      const drawControl = new (L as any).Control.Draw({
        position: 'topleft',
        draw: { polyline:false, circle:false, circlemarker:false, marker:false, rectangle:true, polygon:true },
        edit: { featureGroup: drawn }
      });
      map.addControl(drawControl);

      map.on((L as any).Draw.Event.CREATED, async (e: any) => {
        if (cancelled || !mapRef.current) return;
        const layer = e.layer; drawn.addLayer(layer);
        const gj = layer.toGeoJSON();
        if (aoiRef.current) { mapRef.current.removeLayer(aoiRef.current); aoiRef.current = null; }
        aoiRef.current = L.geoJSON(gj, { style: { color: '#0ea5e9', weight: 2 } }).addTo(mapRef.current);
        setStatus('Finding parcels within drawn AOI...');
        const res = await fetch('/api/within?distance=' + (aoiBufferDist||0), {
          method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(gj)
        });
        const fc = await res.json();
        setStatus('');
        if (!mapRef.current) return;
        if (fc.features?.length) {
          clearLayer(selectionRef);
          selectionRef.current = L.geoJSON(fc, { style: { color: '#16a34a', weight: 2, fillOpacity: 0.1 } }).addTo(mapRef.current);
          setTableFeatures(fc);
          try { mapRef.current.fitBounds((selectionRef.current as any).getBounds(), { padding: [20,20] }); } catch {}
        } else {
          setTableFeatures({ type:'FeatureCollection', features: [] });
        }
      });

      // Parcels
      const parcelsFc: FeatureCollection = await fetch('/api/parcels').then(r=>r.json());
      if (cancelled || !mapRef.current) return;

      const parcelLayer = L.geoJSON(parcelsFc, {
        style: { weight: 2, color: '#334155', fillOpacity: 0.07 },
        onEachFeature: (f: any, l: any) => {
          const p = f.properties || {};
          l.bindPopup(`<b>Parcel ${p.id ?? ''}</b><br/>Owner: ${p.owner ?? ''}`);
          l.on('click', () => { selectParcel(p.id, f as Feature); });
        }
      }).addTo(mapRef.current as any);
      parcelLayerRef.current = parcelLayer;
      try { mapRef.current!.fitBounds(parcelLayer.getBounds(), { padding: [20,20] }); } catch {}

      // Optional overlays
      fetch('/data/roads_sample.json').then(r=>r.json()).then(fc2 => {
        if (cancelled || !mapRef.current) return;
        roadsRef.current = L.geoJSON(fc2, { style: { color: '#ea580c', weight: 2 } });
        if (showRoads) roadsRef.current.addTo(mapRef.current as any);
      });
      fetch('/data/zoning_sample.json').then(r=>r.json()).then(fc3 => {
        if (cancelled || !mapRef.current) return;
        zoningRef.current = L.geoJSON(fc3, { style: { color: '#8b5cf6', weight: 1, fillOpacity: 0.06 } });
        if (showZoning) zoningRef.current.addTo(mapRef.current as any);
      });

    })();

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Layer helpers ----------
  function clearLayer(ref: React.MutableRefObject<any>) {
    if (!mapRef.current || !ref.current) return;
    mapRef.current.removeLayer(ref.current);
    ref.current = null;
  }

  function toggleLayer(ref: React.MutableRefObject<any>, show: boolean) {
    if (!mapRef.current) return;
    const layer = ref?.current;
    if (!layer) return;
    if (show) { try { layer.addTo(mapRef.current); } catch {} }
    else { try { mapRef.current.removeLayer(layer); } catch {} }
  }

  function selectParcel(id: number, f?: Feature) {
    setSelectedId(id);
    setSelectedFeature(f || null);
    if (!mapRef.current || !f) return;
    const L = LRef.current;
    clearLayer(selectionRef);
    selectionRef.current = L.geoJSON(f, { style: { color: '#16a34a', weight: 3, fillOpacity: 0.1 } }).addTo(mapRef.current);
  }

  function zoomToRow(f: any) {
    if (!mapRef.current) return;
    const L = LRef.current;
    setSelectedId(f?.properties?.id ?? null);
    setSelectedFeature(f as any);
    clearLayer(selectionRef);
    try {
      selectionRef.current = L.geoJSON(f, { style: { color: '#16a34a', weight: 3, fillOpacity: 0.15 } }).addTo(mapRef.current);
      const b = (selectionRef.current as any).getBounds?.();
      if (b && b.isValid && b.isValid()) mapRef.current.fitBounds(b, { padding: [20,20] });
    } catch {}
  }

  async function runSearch() {
    const fc: FeatureCollection = await fetch('/api/search?text=' + encodeURIComponent(query)).then(r=>r.json());
    if (!mapRef.current || !fc.features.length) return;
    const L = await ensureLeaflet();
    clearLayer(selectionRef);
    const first = fc.features[0] as any;
    setSelectedId(first.properties?.id ?? null);
    setSelectedFeature(first as Feature);
    selectionRef.current = L.geoJSON(first, { style: { color: '#16a34a', weight: 3, fillOpacity: 0.15 } }).addTo(mapRef.current);
    setTableFeatures(fc);
    try { mapRef.current.fitBounds((selectionRef.current as any).getBounds(), { padding: [20,20] }); } catch {}
  }

  async function makeBuffer() {
    if (!selectedId) { setStatus('Select a parcel first.'); return; }
    setStatus('Buffering…');
    const res = await fetch(`/api/buffer?parcelId=${selectedId}&distance=${bufferDist}`);
    const data = await res.json();
    setStatus('');
    if (!mapRef.current) return;
    const L = await ensureLeaflet();
    clearLayer(bufferRef);
    bufferRef.current = L.geoJSON(data.buffer, { style: { color: '#2563eb', dashArray: '4,3', weight: 2 } }).addTo(mapRef.current);
    if (data.intersects?.features?.length) {
      setTableFeatures(data.intersects);
      L.geoJSON(data.intersects, { style: { color: '#ef4444', weight: 2, fillOpacity: 0.1 } }).addTo(mapRef.current);
    }
  }

  async function exportSelection() {
    const res = await fetch('/api/export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'selection.geojson'; a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPNG() {
    if (!mapDivRef.current || !mapRef.current) return;
    const { default: html2canvas } = await import('html2canvas');
    const m: any = mapRef.current;

    // Hide overlay during capture
    const ov = overlayRef.current;
    const prevVis = ov?.style.visibility;
    if (ov) ov.style.visibility = 'hidden';

    // Ensure CORS-friendly base (temporary) if needed
    let usedTemp = false;
    let tempBase: any = null;
    const canUseCurrent = !!(m._currentBase && (m._currentBase.options?.crossOrigin || m._currentBase.getLayers));
    if (!canUseCurrent) {
      const fallbackKind = dark ? 'carto-dark' : 'carto';
      tempBase = getBasemapLayer(fallbackKind as any);
      if (tempBase) {
        m.addLayer(tempBase);
        if (tempBase.bringToBack) try { tempBase.bringToBack(); } catch {}
        usedTemp = true;
        await new Promise<void>(resolve => tempBase.on ? tempBase.on('load', () => setTimeout(resolve, 80)) : setTimeout(resolve, 120));
      }
    }

    const canvas = await html2canvas(mapDivRef.current, { useCORS: true, allowTaint: true, backgroundColor: null } as any);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'map.png'; a.click();

    if (usedTemp && tempBase) { try { m.removeLayer(tempBase); } catch {} }
    if (ov) ov.style.visibility = prevVis || '';
  }

  async function downloadPDF() {
    if (!mapDivRef.current) return;
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(mapDivRef.current);
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(img, 'PNG', 20, 20, pageWidth-40, pageHeight-40);
    pdf.save('map.pdf');
  }

  function getBasemapLayer(kind: 'osm'|'carto'|'carto-dark'|'esri'|'hybrid'): any {
    const L = LRef.current;
    if (!L) return null;
    const mk = (url: string) => L.tileLayer(url, { maxZoom: 19, crossOrigin: true as any });
    if (kind === 'carto') return mk('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
    if (kind === 'carto-dark') return mk('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
    if (kind === 'esri') return mk('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    if (kind === 'hybrid') {
      const imagery = mk('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
      const labels = mk('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}');
      return L.layerGroup([imagery, labels]);
    }
    return mk('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  }

  function setBasemapLayer(kind: 'osm'|'carto'|'carto-dark'|'esri'|'hybrid') {
    if (!mapRef.current) return;
    const L = LRef.current;
    if (!L) return;
    const m = mapRef.current as any;
    const next = getBasemapLayer(kind);
    if (!next) return;
    if (m._currentBase) m.removeLayer(m._currentBase);
    m._currentBase = next.addTo(mapRef.current!);
    if ('bringToBack' in (m._currentBase as any)) { try { (m._currentBase as any).bringToBack(); } catch {} }
    setBasemap(kind);
  }

  function computeStats(f: Feature) {
    try {
      const aHa = area(f as any) / 10_000;
      const line = polygonToLine(f as any);
      const pKm = length(line as any, { units: 'kilometers' });
      return { areaHa: aHa, perimeterKm: pKm };
    } catch {
      return { areaHa: null, perimeterKm: null };
    }
  }

  async function uploadAOI(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const txt = await file.text();
    const gj = JSON.parse(txt);
    if (!mapRef.current) return;
    const L = await ensureLeaflet();
    if (aoiRef.current) { mapRef.current.removeLayer(aoiRef.current); aoiRef.current = null; }
    aoiRef.current = L.geoJSON(gj, { style: { color: '#0ea5e9', weight: 2 } }).addTo(mapRef.current);
    setStatus('Finding parcels within AOI...');
    const res = await fetch('/api/within?distance=' + (aoiBufferDist||0), { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(gj) });
    const fc = await res.json();
    setStatus('');
    if (fc.features?.length) {
      clearLayer(selectionRef);
      selectionRef.current = L.geoJSON(fc, { style: { color: '#16a34a', weight: 2, fillOpacity: 0.1 } }).addTo(mapRef.current!);
      setTableFeatures(fc);
      try { mapRef.current!.fitBounds((selectionRef.current as any).getBounds(), { padding: [20,20] }); } catch {}
    } else {
      setTableFeatures({ type:'FeatureCollection', features: [] });
    }
  }

  // ----------------------------- UI -----------------------------
  return (
    <main className={'max-w-6xl mx-auto p-4'}>
      <header className="mb-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2"><MapIcon className="w-5 h-5"/> Parcel Dashboard Pro</h1>
          <span className="text-white/80 text-sm">{status}</span>
        </div>
        <p className="text-white/80 text-sm mt-1">Web GIS utility with buffer, AOI select, draw tools, and exports.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        <div className="md:col-span-2">
          <div className="relative">
            <div ref={mapDivRef} className="w-full h-[70vh] md:h-[78vh] rounded-2xl border bg-white" />
            {/* Floating Controls */}
            <div ref={overlayRef} className="pointer-events-none absolute top-3 left-3 right-3 md:left-4 md:right-auto z-[500] space-y-2">
              <div className="pointer-events-auto glass rounded-2xl p-3 md:w-[560px]">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 text-slate-500" />
                    <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search id or owner" className="border px-3 py-2 rounded w-full" />
                    <button onClick={runSearch} className="px-3 py-2 rounded border bg-white dark:bg-slate-800">Search</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Basemap</label>
                    <select value={basemap} onChange={(e)=>setBasemapLayer(e.target.value as any)} className="border px-2 py-1 rounded">
                      <option value="osm">OSM</option>
                      <option value="carto">Carto Light</option>
                      <option value="carto-dark">Carto Dark</option>
                      <option value="esri">Esri</option>
                      <option value="hybrid">Hybrid (Imagery + Labels)</option>
                    </select>
                  </div>
                  <button
                    onClick={async()=>{ 
                      setLocating(true);
                      try{
                        await new Promise<void>((resolve,reject)=>{
                          mapRef.current?.locate({setView:true,maxZoom:16});
                          mapRef.current?.once('locationfound', ()=>resolve());
                          mapRef.current?.once('locationerror', ()=>reject());
                        });
                      }catch{} finally{ setLocating(false); }
                    }}
                    className="px-3 py-2 rounded border bg-white dark:bg-slate-800" title="Locate me">
                    <Target className={"w-4 h-4 " + (locating ? "animate-pulse" : "")} />
                  </button>
                  <button onClick={()=>setDark(d=>!d)} className="px-3 py-2 rounded border bg-white dark:bg-slate-800" title="Toggle dark">
                    <SunMoon className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">Parcel buffer (m)</span>
                    <input type="number" value={bufferDist} onChange={(e)=>setBufferDist(parseInt(e.target.value||'0'))} className="border px-2 py-1 w-24 rounded" />
                    <button onClick={makeBuffer} className="px-3 py-2 rounded border bg-white dark:bg-slate-800">Run</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <label className="text-sm"><input type="checkbox" checked={showRoads} onChange={(e)=>{setShowRoads(e.target.checked); toggleLayer(roadsRef, e.target.checked);}} className="mr-1"/>Roads</label>
                    <label className="text-sm"><input type="checkbox" checked={showZoning} onChange={(e)=>{setShowZoning(e.target.checked); toggleLayer(zoningRef, e.target.checked);}} className="mr-1"/>Zoning</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">AOI buffer (m)</span>
                    <input type="number" value={aoiBufferDist} onChange={(e)=>setAoiBufferDist(parseInt(e.target.value||'0'))} className="border px-2 py-1 w-28 rounded" />
                    <input type="file" accept=".geojson,application/geo+json,application/json" onChange={uploadAOI} />
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={exportSelection} className="px-3 py-2 rounded border bg-white dark:bg-slate-800" title="Export selection GeoJSON"><FileDown className="w-4 h-4" /></button>
                    <button onClick={downloadPNG} className="px-3 py-2 rounded border bg-white dark:bg-slate-800" title="Download PNG"><Download className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              <div className="pointer-events-auto glass rounded-2xl p-2 inline-flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm" style={{background:'#334155'}}></div><span className="text-xs">Parcels</span>
                <div className="w-3 h-3 rounded-sm" style={{background:'#ea580c'}}></div><span className="text-xs">Roads</span>
                <div className="w-3 h-3 rounded-sm" style={{background:'#8b5cf6'}}></div><span className="text-xs">Zoning</span>
                <div className="w-3 h-3 rounded-sm border-2" style={{borderColor:'#0ea5e9'}}></div><span className="text-xs">AOI</span>
                <div className="w-3 h-3 rounded-sm border-2" style={{borderColor:'#16a34a'}}></div><span className="text-xs">Selection</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="glass rounded-2xl p-4">
          <h2 className="font-semibold mb-2">Selection</h2>
          {selectedId ? (
            <div className="text-sm">
              <div><b>Parcel ID:</b> {selectedId}</div>
              {selectedFeature && (()=>{ const s = computeStats(selectedFeature); return (
                <div className="mt-2">
                  <div>Area: {s.areaHa ? s.areaHa.toFixed(3) : '—'} ha</div>
                  <div>Perimeter: {s.perimeterKm ? s.perimeterKm.toFixed(3) : '—'} km</div>
                </div>
              )})()}
              <p className="text-slate-500 mt-2">Use Buffer to find intersecting parcels. Upload or draw an AOI to select by area.</p>
            </div>
          ) : <p className="text-sm text-slate-500">No parcel selected.</p>}

          <div className="mt-4">
            <h3 className="font-semibold mb-2">Attribute Table ({tableFeatures.features?.length || 0})</h3>
            <div className="max-h-64 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr><th className="text-left px-2 py-1 border-b">ID</th><th className="text-left px-2 py-1 border-b">Owner</th></tr>
                </thead>
                <tbody>
                  {(tableFeatures.features||[]).map((f:any)=> (
                    <tr
                      key={f.properties?.id}
                      onClick={()=>zoomToRow(f)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      role="button"
                      title="Click to zoom"
                    >
                      <td className="px-2 py-1 border-b">{f.properties?.id}</td>
                      <td className="px-2 py-1 border-b">{f.properties?.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>

      <p className="text-slate-500 text-sm mt-2">Tip: Click a table row or parcel to select; then buffer or upload/draw an AOI.</p>
    </main>
  );
}
