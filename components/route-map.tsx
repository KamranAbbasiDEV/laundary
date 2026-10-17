'use client';

import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';

export default function RouteMap({ routeCoordinates, stopCoordinates }: { routeCoordinates: [number, number][]; stopCoordinates: [number, number][] }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!element.current || !token || !stopCoordinates.length) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({ container: element.current, style: 'mapbox://styles/mapbox/light-v11', center: stopCoordinates[0], zoom: stopCoordinates.length === 1 ? 12 : 10, attributionControl: false });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    const fit = new mapboxgl.LngLatBounds();
    stopCoordinates.forEach((coordinate, index) => { fit.extend(coordinate); new mapboxgl.Marker({ color: index === 0 ? '#0d7c78' : '#0f1f35' }).setLngLat(coordinate).setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`Stop ${index + 1}`)).addTo(map); });
    map.on('load', () => {
      if (routeCoordinates.length > 1) { map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoordinates } } }); map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#0d7c78', 'line-width': 5, 'line-opacity': .88 } }); map.fitBounds(fit, { padding: 54, duration: 0, maxZoom: 14 }); }
    });
    return () => map.remove();
  }, [routeCoordinates, stopCoordinates]);
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return <div className="route-map route-map-empty">Mapbox token is not configured.</div>;
  return <div className="route-map" ref={element}/>;
}
