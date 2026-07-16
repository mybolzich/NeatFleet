import type { RoutingProvider, RoutePath, LatLng } from '../types';

// No default: the public router.project-osrm.org demo server is explicitly
// unsuitable for production (unlimited/free demo, no SLA). Self-host OSRM or
// point this at a paid/managed OSRM host and set the URL via env var.
const BASE_URL = (import.meta.env.VITE_OSRM_BASE_URL as string) || '';

interface OsrmRouteResponse {
  code: string;
  routes: Array<{
    geometry: { coordinates: [number, number][] }; // [lng, lat]
    distance: number;
    duration: number;
  }>;
}

// OSRM's Route service (http://project-osrm.org/docs/master/api/#route-service).
// Point VITE_OSRM_BASE_URL at your own self-hosted or managed OSRM instance.
export const osrmRouting: RoutingProvider = {
  async route(waypoints: LatLng[]): Promise<RoutePath | null> {
    if (!BASE_URL || waypoints.length < 2) return null;

    try {
      const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
      const res = await fetch(`${BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      if (!res.ok) return null;

      const data = (await res.json()) as OsrmRouteResponse;
      if (data.code !== 'Ok' || !data.routes?.[0]) return null;

      const route = data.routes[0];
      return {
        path: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    } catch {
      return null;
    }
  },
};
