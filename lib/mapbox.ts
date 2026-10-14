export async function geocodeAddress(address: string) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('Mapbox is not configured');
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(address)}&limit=1&access_token=${token}`;
  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Mapbox geocoding failed: ${response.status}`);
  const body = await response.json();
  const coordinates = body.features?.[0]?.geometry?.coordinates ?? null;
  return { address, coordinates, source: 'mapbox' };
}

export async function calculateRoute(coordinates: [number, number][]) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('Mapbox is not configured');
  if (coordinates.length < 2) throw new Error('At least two coordinates are required to calculate a route');
  const path = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?overview=full&geometries=geojson&access_token=${token}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mapbox directions failed: ${response.status}`);
  const body = await response.json();
  const route = body.routes?.[0];
  return { coordinates: route?.geometry?.coordinates ?? coordinates, distanceMeters: route?.distance ?? null, durationSeconds: route?.duration ?? null, source: 'mapbox' };
}
