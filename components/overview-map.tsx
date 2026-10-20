'use client';

import mapboxgl from 'mapbox-gl';
import { Map, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { humanize } from '@/lib/presentation';

type Coordinates = [number, number];
type Plan = { id: string; route_date: string; route_type: string; status: string; mapbox_route?: { coordinates?: Coordinates[] } | null; driver_location?: { longitude: number; latitude: number; recorded_at: string } | null };
const tones = ['#0d7c78', '#2563eb', '#7c3aed', '#d97706'];

export default function OverviewMap() {
  const element = useRef<HTMLDivElement>(null); const map = useRef<mapboxgl.Map | null>(null);
  const renderedIds = useRef<Set<string>>(new Set());
  const [plans, setPlans] = useState<Plan[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [mapReady, setMapReady] = useState(false);
  const load = useCallback(async () => { try { const response = await fetch('/api/route-plans', { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load active routes.'); setPlans((body.plans ?? []).filter((plan: Plan) => Array.isArray(plan.mapbox_route?.coordinates) && plan.mapbox_route.coordinates.length)); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load active routes.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 15000); const refresh = () => void load(); window.addEventListener('rinseline:data-changed', refresh); return () => { window.clearInterval(id); window.removeEventListener('rinseline:data-changed', refresh); }; }, [load]);
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!element.current || !token || map.current) return;
    mapboxgl.accessToken = token;
    const instance = new mapboxgl.Map({ container: element.current, style: 'mapbox://styles/mapbox/light-v11', center: [-98.5795, 39.8283], zoom: 3.2, attributionControl: false });
    instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right'); map.current = instance;
    instance.once('load', () => setMapReady(true));
    return () => { instance.remove(); map.current = null; setMapReady(false); };
  }, []);
  useEffect(() => {
    const instance = map.current; if (!instance) return;
    const render = () => {
      const activeSourceIds = new Set<string>();
      const bounds = new mapboxgl.LngLatBounds();
      plans.forEach((plan, index) => {
        const sourceId = `overview-route-${plan.id}`; activeSourceIds.add(sourceId); const layerId = `${sourceId}-line`; const coordinates = plan.mapbox_route?.coordinates ?? [];
        coordinates.forEach((point) => bounds.extend(point));
        const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } };
        if (instance.getSource(sourceId)) (instance.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data); else { instance.addSource(sourceId, { type: 'geojson', data }); instance.addLayer({ id: layerId, type: 'line', source: sourceId, paint: { 'line-color': tones[index % tones.length], 'line-width': 4, 'line-opacity': .82 } }); }
        const driverSourceId = `${sourceId}-driver`;
        if (plan.driver_location) {
          activeSourceIds.add(driverSourceId);
          const point = [plan.driver_location.longitude, plan.driver_location.latitude] as Coordinates; bounds.extend(point);
          const driverData = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: point } };
          if (instance.getSource(driverSourceId)) (instance.getSource(driverSourceId) as mapboxgl.GeoJSONSource).setData(driverData); else { instance.addSource(driverSourceId, { type: 'geojson', data: driverData }); instance.addLayer({ id: `${driverSourceId}-dot`, type: 'circle', source: driverSourceId, paint: { 'circle-radius': 7, 'circle-color': '#0d7c78', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } }); }
        }
      });
      renderedIds.current.forEach((sourceId) => { if (activeSourceIds.has(sourceId)) return; const layerId = sourceId.endsWith('-driver') ? `${sourceId}-dot` : `${sourceId}-line`; if (instance.getLayer(layerId)) instance.removeLayer(layerId); if (instance.getSource(sourceId)) instance.removeSource(sourceId); });
      renderedIds.current = activeSourceIds;
      if (!bounds.isEmpty()) instance.fitBounds(bounds, { padding: 54, duration: 450, maxZoom: 13 });
    };
    if (instance.loaded()) render(); else instance.once('load', render);
  }, [plans, mapReady]);
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return <section className="panel overview-map-panel"><div className="overview-map-empty"><Map size={20}/><strong>Mapbox overview needs a public browser token.</strong><span>Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to render the live map.</span></div></section>;
  return <section className="panel overview-map-panel"><div className="panel-heading"><div><h2>Live route map</h2><p>Active draft, approved, and in-progress routes. Refreshes every 30 seconds.</p></div><button className="button button-quiet" type="button" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? 'spin' : ''} size={14}/>Refresh</button></div>{error ? <div className="overview-map-empty"><strong>Map data unavailable</strong><span>{error}</span></div> : <><div ref={element} className="overview-map"/>{!loading && !plans.length && <div className="overview-map-empty overlay"><Map size={20}/><strong>No active routes yet</strong><span>Generated routes will appear here automatically.</span></div>}<div className="overview-map-legend">{plans.slice(0, 4).map((plan, index) => <span key={plan.id}><i style={{ background: tones[index % tones.length] }}/>{humanize(plan.route_type)} · {humanize(plan.status)}</span>)}</div></>}</section>;
}
