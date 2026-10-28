'use client';

import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';

export default function RouteMap({ routeCoordinates, stopCoordinates, currentLocation, selectedStopIndex, focusCoordinate }: { routeCoordinates: [number, number][]; stopCoordinates: [number, number][]; currentLocation?: [number, number] | null; selectedStopIndex?: number; focusCoordinate?: [number, number] | null }) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!element.current || !token || !stopCoordinates.length) return;
    setError(null);
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({ container: element.current, style: 'mapbox://styles/mapbox/light-v11', center: stopCoordinates[0], zoom: stopCoordinates.length === 1 ? 12 : 10, attributionControl: false });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    const fit = new mapboxgl.LngLatBounds();
    stopCoordinates.forEach((coordinate, index) => { fit.extend(coordinate); new mapboxgl.Marker({ color: index === selectedStopIndex ? '#dc2626' : index === 0 ? '#0d7c78' : '#0f1f35' }).setLngLat(coordinate).setPopup(new mapboxgl.Popup({ offset: 18 }).setText(index === selectedStopIndex ? `Selected stop ${index + 1}` : `Stop ${index + 1}`)).addTo(map); });
    if (currentLocation) { fit.extend(currentLocation); new mapboxgl.Marker({ color: '#d97706' }).setLngLat(currentLocation).setPopup(new mapboxgl.Popup({ offset: 18 }).setText('Your last reported location')).addTo(map); }
    map.on('error', event => setError(event.error?.message || 'Mapbox could not load this map. Check the access token and its allowed URLs.'));
    map.on('load', () => {
      if (routeCoordinates.length > 1) { map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoordinates } } }); map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#0d7c78', 'line-width': 5, 'line-opacity': .88 } }); }
      map.fitBounds(fit, { padding: 54, duration: 0, maxZoom: 14 });
      if (focusCoordinate) map.flyTo({ center: focusCoordinate, zoom: 14, duration: 0 });
    });
    return () => map.remove();
  }, [routeCoordinates, stopCoordinates, currentLocation, selectedStopIndex, focusCoordinate]);
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return <div className="route-map route-map-empty">Mapbox token is not configured.</div>;
  if (error) return <div className="route-map route-map-empty">{error}</div>;
  return <div className="route-map" ref={element}/>;
}
