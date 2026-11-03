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

function directFallbackRoute(coordinates: [number, number][]) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const distanceMeters = coordinates.slice(1).reduce((total, coordinate, index) => {
    const previous = coordinates[index];
    const latitudeDelta = toRadians(coordinate[1] - previous[1]);
    const longitudeDelta = toRadians(coordinate[0] - previous[0]);
    const latitudeA = toRadians(previous[1]);
    const latitudeB = toRadians(coordinate[1]);
    const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
    return total + 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
  }, 0);
  return {
    coordinates,
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(distanceMeters / (50_000 / 3_600)),
    source: 'direct_fallback',
    warning: 'Testing fallback: Mapbox exceeded its maximum driving distance, so this route uses direct stop-to-stop geometry and estimated totals.'
  };
}

export async function calculateRoute(coordinates: [number, number][]) {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('Mapbox is not configured');
  if (coordinates.length === 0) throw new Error('At least one valid address is required to calculate a route');
  if (coordinates.length > 25) throw new Error('Mapbox routes support at most 25 stops. Split this work into another route.');
  const routeCoordinates = coordinates.filter(
    (coordinate, index) =>
      index === 0 ||
      coordinate[0] !== coordinates[index - 1][0] ||
      coordinate[1] !== coordinates[index - 1][1],
  );
  if (routeCoordinates.length === 1) return { coordinates: routeCoordinates, distanceMeters: 0, durationSeconds: 0, source: 'mapbox' };
  const path = routeCoordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?overview=full&geometries=geojson&access_token=${token}`;
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 422 && typeof body?.message === 'string' && /maximum distance/i.test(body.message)) {
      return directFallbackRoute(routeCoordinates);
    }
    const providerMessage = typeof body?.message === 'string' ? ` ${body.message}` : '';
    throw new Error(`Mapbox could not build a drivable route (${response.status}).${providerMessage}`);
  }
  const route = body.routes?.[0];
  if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new Error('Mapbox did not return route distance and duration');
  return { coordinates: route.geometry?.coordinates ?? routeCoordinates, distanceMeters: route.distance, durationSeconds: route.duration, source: 'mapbox' };
}
