import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig } from '../../../types';
import type { OptimizationProvider } from '../types';
import { orToolsProvider } from './orToolsProvider';
import { heuristicProvider } from './heuristicProvider';

export type OptimizerBackend = 'or-tools' | 'heuristic';

// Tries the OR-Tools VRP solver first (real distance-matrix-aware VRP with
// time windows + capacity constraints, solved server-side). Falls back to
// the local in-browser heuristic if OR-Tools is unreachable — Python/OR-Tools
// missing locally, the Vercel function cold-failing, no network, etc — so
// Build Routes always produces a result.
export function getOptimizationProvider(): OptimizationProvider<Stop, Vehicle, Depot, TrafficZone, OptimizerConfig> & {
  optimizeRoutesWithBackend: (
    stops: Stop[], vehicles: Vehicle[], depot: Depot, trafficZones: TrafficZone[], config: OptimizerConfig
  ) => Promise<{ optimizedStops: Stop[]; optimizedVehicles: Vehicle[]; backend: OptimizerBackend }>;
} {
  return {
    async optimizeRoutes(stops, vehicles, depot, trafficZones, config) {
      const { optimizedStops, optimizedVehicles } = await this.optimizeRoutesWithBackend(
        stops, vehicles, depot, trafficZones, config
      );
      return { optimizedStops, optimizedVehicles };
    },

    async optimizeRoutesWithBackend(stops, vehicles, depot, trafficZones, config) {
      try {
        const result = await orToolsProvider.optimizeRoutes(stops, vehicles, depot, trafficZones, config);
        return { ...result, backend: 'or-tools' };
      } catch (err) {
        console.warn('[optimizer] OR-Tools unavailable, falling back to local heuristic:', err);
        const result = await heuristicProvider.optimizeRoutes(stops, vehicles, depot, trafficZones, config);
        return { ...result, backend: 'heuristic' };
      }
    },
  };
}
