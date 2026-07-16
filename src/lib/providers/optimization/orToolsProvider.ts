import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig } from '../../../types';
import type { OptimizationProvider } from '../types';

interface OptimizeResponse {
  optimizedStops: Stop[];
  optimizedVehicles: Vehicle[];
}

// Calls the OR-Tools VRP solver behind /api/optimize (a Vercel Python
// serverless function in production; a local child_process spawn of the
// same solver via server.ts in dev — see api/optimize.py / api/optimize_cli.py).
// Throws on any failure so callers can fall back to the local heuristic.
export const orToolsProvider: OptimizationProvider<Stop, Vehicle, Depot, TrafficZone, OptimizerConfig> = {
  async optimizeRoutes(stops, vehicles, depot, trafficZones, config) {
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops, vehicles, depot, trafficZones, config }),
    });

    if (!res.ok) {
      throw new Error(`OR-Tools optimize request failed: ${res.status}`);
    }

    const data = (await res.json()) as OptimizeResponse;
    if (!data.optimizedStops || !data.optimizedVehicles) {
      throw new Error('OR-Tools optimize response missing expected fields');
    }

    return data;
  },
};
