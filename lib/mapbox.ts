/** Returns only the browser-safe Mapbox token; never expose the server token. */
export function publicMapboxToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
}

export async function geocodeAddress(address: string) {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('Mapbox is not configured');
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(address)}&limit=1&access_token=${token}`;
  // Mapbox v6 geocoding results are temporary by default and must not be cached.
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Mapbox geocoding failed: ${response.status}`);
  const body = await response.json();
  const coordinates = body.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every((value: unknown) => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error(`Mapbox could not locate the address: ${address}`);
  }
  return { address, coordinates: coordinates as [number, number], source: 'mapbox' };
}

export async function calculateRoute(coordinates: [number, number][]) {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('Mapbox is not configured');
  if (coordinates.length === 0) throw new Error('At least one valid address is required to calculate a route');
  if (coordinates.length === 1) return { coordinates, distanceMeters: 0, durationSeconds: 0, source: 'mapbox' };
  const path = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?overview=full&geometries=geojson&access_token=${token}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mapbox directions failed: ${response.status}`);
  const body = await response.json();
  const route = body.routes?.[0];
  if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new Error('Mapbox did not return route distance and duration');
  return { coordinates: route.geometry?.coordinates ?? coordinates, distanceMeters: route.distance, durationSeconds: route.duration, source: 'mapbox' };
}
