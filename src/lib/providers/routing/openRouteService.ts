import type { RoutingProvider, RoutePath, LatLng } from '../types';

const BASE_URL = (import.meta.env.VITE_ORS_BASE_URL as string) || 'https://api.openrouteservice.org';
const API_KEY = (import.meta.env.VITE_ORS_API_KEY as string) || '';

interface OrsDirectionsResponse {
  features: Array<{
    geometry: { coordinates: [number, number][] }; // [lng, lat]
    properties: { summary: { distance: number; duration: number } };
  }>;
}

// OpenRouteService's hosted Directions API (driving-car profile). Free-tier
// API key required — see https://openrouteservice.org/dev/#/signup.
export const openRouteServiceRouting: RoutingProvider = {
  async route(waypoints: LatLng[]): Promise<RoutePath | null> {
    if (!API_KEY || waypoints.length < 2) return null;

    try {
      const res = await fetch(`${BASE_URL}/v2/directions/driving-car/geojson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: API_KEY,
        },
        body: JSON.stringify({
          coordinates: waypoints.map((p) => [p.lng, p.lat]),
        }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as OrsDirectionsResponse;
      const feature = data.features?.[0];
      if (!feature) return null;

      return {
        path: feature.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distanceMeters: feature.properties.summary.distance,
        durationSeconds: feature.properties.summary.duration,
      };
    } catch {
      return null;
    }
  },
};
