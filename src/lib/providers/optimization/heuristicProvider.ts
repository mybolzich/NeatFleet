import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig } from '../../../types';
import { optimizeRoutes } from '../../../utils/optimizer';
import type { OptimizationProvider } from '../types';

// Wraps the existing in-browser nearest-neighbor/insertion heuristic
// (utils/optimizer.ts) as an OptimizationProvider. Always available — no
// network call — used as the fallback when the OR-Tools service can't be
// reached (e.g. Python/OR-Tools not installed locally, or the Vercel
// function is cold/unreachable).
export const heuristicProvider: OptimizationProvider<Stop, Vehicle, Depot, TrafficZone, OptimizerConfig> = {
  async optimizeRoutes(stops, vehicles, depot, trafficZones, config) {
    return optimizeRoutes(stops, vehicles, depot, trafficZones, config);
  },
};
