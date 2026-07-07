import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig, Priority } from '../types';

// Helper: Calculate Euclidean distance
export function getDistance(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(from.x - to.x, 2) + Math.pow(from.y - to.y, 2));
}

// Helper: Check if line segment from A to B intersects or passes close to a traffic zone
export function getPathTrafficDelay(
  from: { x: number; y: number },
  to: { x: number; y: number },
  trafficZones: TrafficZone[],
  trafficAware: boolean
): number {
  if (!trafficAware || trafficZones.length === 0) return 1.0;

  let maxDelay = 1.0;
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

  for (const zone of trafficZones) {
    // Check if midpoint of route or endpoints are inside traffic zone
    const distMid = getDistance(midpoint, zone);
    const distFrom = getDistance(from, zone);
    const distTo = getDistance(to, zone);

    // If any part of the path is within the traffic zone, apply the traffic factor
    if (distMid <= zone.radius || distFrom <= zone.radius || distTo <= zone.radius) {
      maxDelay = Math.max(maxDelay, zone.delayFactor);
    }
  }

  return maxDelay;
}

// Helper: Calculate travel time in minutes
export function getTravelTime(
  from: { x: number; y: number },
  to: { x: number; y: number },
  speed: number,
  trafficZones: TrafficZone[],
  trafficAware: boolean
): { time: number; distance: number } {
  const distance = getDistance(from, to);
  const delayFactor = getPathTrafficDelay(from, to, trafficZones, trafficAware);
  const baseTime = distance / speed; // time = distance / speed
  return {
    time: baseTime * delayFactor,
    distance,
  };
}

// Evaluate a route for a single vehicle and calculate precise metrics, sequence numbers, and ETAs
export function evaluateRoute(
  routeStops: Stop[],
  vehicle: Vehicle,
  depot: Depot,
  trafficZones: TrafficZone[],
  trafficAware: boolean
): {
  evaluatedStops: Stop[];
  metrics: Vehicle['metrics'];
} {
  const evaluatedStops: Stop[] = [];
  let currentTime = vehicle.shiftStart;
  let currentPosition = { x: depot.x, y: depot.y };
  let totalDistance = 0;
  let totalLoad = 0;
  let delayCount = 0;

  for (let i = 0; i < routeStops.length; i++) {
    const stop = routeStops[i];
    const { time: driveTime, distance } = getTravelTime(
      currentPosition,
      stop,
      vehicle.speed,
      trafficZones,
      trafficAware
    );

    totalDistance += distance;
    const arrivalTime = currentTime + driveTime;
    const serviceStartTime = Math.max(arrivalTime, stop.timeWindowStart);
    const departureTime = serviceStartTime + stop.serviceDuration;

    let isDelayed = false;
    if (serviceStartTime > stop.timeWindowEnd) {
      isDelayed = true;
      delayCount++;
    }

    evaluatedStops.push({
      ...stop,
      assignedVehicleId: vehicle.id,
      stopSequence: i,
      eta: Math.round(arrivalTime),
      arrivalTime: Math.round(arrivalTime),
      status: isDelayed ? 'Delayed' : 'Pending', // during planning, it represents warning status
    });

    totalLoad += stop.volume;
    currentTime = departureTime;
    currentPosition = { x: stop.x, y: stop.y };
  }

  // Return to depot
  const { time: returnTime, distance: returnDistance } = getTravelTime(
    currentPosition,
    depot,
    vehicle.speed,
    trafficZones,
    trafficAware
  );
  totalDistance += returnDistance;
  const finalTime = currentTime + returnTime;

  // Costs calculation: cost per distance unit + cost per operational hour
  const hoursUsed = (finalTime - vehicle.shiftStart) / 60;
  const travelCost = totalDistance * vehicle.costPerMile;
  const hourlyCost = hoursUsed * vehicle.costPerHour;
  const totalCost = travelCost + hourlyCost;

  return {
    evaluatedStops,
    metrics: {
      totalDistance: parseFloat(totalDistance.toFixed(1)),
      totalTime: Math.round(finalTime - vehicle.shiftStart),
      loadUsed: totalLoad,
      delayCount,
      totalCost: parseFloat(totalCost.toFixed(2)),
    },
  };
}

// Main VRP with Time Windows Solver
export function optimizeRoutes(
  stops: Stop[],
  vehicles: Vehicle[],
  depot: Depot,
  trafficZones: TrafficZone[],
  config: OptimizerConfig
): {
  optimizedStops: Stop[];
  optimizedVehicles: Vehicle[];
} {
  // Reset all assignments
  const unassignedStops = [...stops].map(s => ({
    ...s,
    assignedVehicleId: null as string | null,
    stopSequence: null as number | null,
    eta: null as number | null,
    arrivalTime: null as number | null,
    status: 'Pending' as const,
  }));

  const activeRoutes: Record<string, Stop[]> = {};
  vehicles.forEach(v => {
    activeRoutes[v.id] = [];
  });

  // Simple Solomon-inspired Insertion Heuristic
  // Iteratively assign unassigned stops to the absolute best spot in the absolute best vehicle route
  while (unassignedStops.some(s => s.assignedVehicleId === null)) {
    let bestInsertion: {
      stopIndex: number;
      vehicleId: string;
      insertAt: number; // index in the route to insert at
      cost: number;
    } | null = null;

    // Evaluate all combinations of unassigned stops, vehicles, and insertion points
    for (let sIdx = 0; sIdx < unassignedStops.length; sIdx++) {
      const stop = unassignedStops[sIdx];
      if (stop.assignedVehicleId !== null) continue;

      for (const vehicle of vehicles) {
        const currentRoute = activeRoutes[vehicle.id];

        // Capacity constraint check: Can the vehicle fit this stop?
        const currentLoad = currentRoute.reduce((sum, r) => sum + r.volume, 0);
        if (currentLoad + stop.volume > vehicle.capacity) {
          // If we weigh capacity strictly, skip. Otherwise we can consider with high penalty
          if (config.capacityWeight > 8) continue;
        }

        // Try inserting at every possible index (from 0 to currentRoute.length)
        for (let insertIdx = 0; insertIdx <= currentRoute.length; insertIdx++) {
          const testRoute = [...currentRoute];
          testRoute.splice(insertIdx, 0, stop);

          // Evaluate this hypothetical route
          const { metrics, evaluatedStops } = evaluateRoute(
            testRoute,
            vehicle,
            depot,
            trafficZones,
            config.trafficAware
          );

          // Calculate cost of this insertion
          // Cost factors:
          // 1. Extra travel distance
          const originalRouteMetrics = evaluateRoute(
            currentRoute,
            vehicle,
            depot,
            trafficZones,
            config.trafficAware
          ).metrics;

          const extraDistance = metrics.totalDistance - originalRouteMetrics.totalDistance;
          const extraTime = metrics.totalTime - originalRouteMetrics.totalTime;

          // Time window violations penalty
          let timeWindowPenalty = 0;
          evaluatedStops.forEach(es => {
            if (es.arrivalTime !== null && es.arrivalTime > es.timeWindowEnd) {
              timeWindowPenalty += (es.arrivalTime - es.timeWindowEnd) * config.timeWindowWeight;
            }
          });

          // Capacity violation penalty (if any)
          let capacityPenalty = 0;
          if (metrics.loadUsed > vehicle.capacity) {
            capacityPenalty += (metrics.loadUsed - vehicle.capacity) * config.capacityWeight * 50;
          }

          // Shift overrun penalty
          let shiftOverrunPenalty = 0;
          const shiftDuration = vehicle.shiftEnd - vehicle.shiftStart;
          if (metrics.totalTime > shiftDuration) {
            shiftOverrunPenalty += (metrics.totalTime - shiftDuration) * 10;
          }

          // Overall insertion cost
          const insertionCost =
            extraDistance * 1.2 +
            extraTime * 0.8 +
            timeWindowPenalty +
            capacityPenalty +
            shiftOverrunPenalty +
            (config.minimizeVehicles && currentRoute.length === 0 ? -150 : 0); // encourage consolidation if minimizeVehicles is active

          if (bestInsertion === null || insertionCost < bestInsertion.cost) {
            bestInsertion = {
              stopIndex: sIdx,
              vehicleId: vehicle.id,
              insertAt: insertIdx,
              cost: insertionCost,
            };
          }
        }
      }
    }

    // If we found a valid insertion, perform it
    if (bestInsertion) {
      const stopToAssign = unassignedStops[bestInsertion.stopIndex];
      stopToAssign.assignedVehicleId = bestInsertion.vehicleId;

      const route = activeRoutes[bestInsertion.vehicleId];
      route.splice(bestInsertion.insertAt, 0, stopToAssign);
    } else {
      // Fallback: If absolutely no valid route can be fit, forcefully assign remaining stops to
      // the vehicle with the most remaining capacity, even if it delays them.
      const firstUnassigned = unassignedStops.find(s => s.assignedVehicleId === null);
      if (!firstUnassigned) break;

      // Find vehicle with least load
      let bestVehicle = vehicles[0];
      let minLoad = Infinity;
      vehicles.forEach(v => {
        const load = activeRoutes[v.id].reduce((sum, s) => sum + s.volume, 0);
        if (load < minLoad) {
          minLoad = load;
          bestVehicle = v;
        }
      });

      firstUnassigned.assignedVehicleId = bestVehicle.id;
      activeRoutes[bestVehicle.id].push(firstUnassigned);
    }
  }

  // Evaluate the final assignments for all vehicles and build the return arrays
  const finalStops: Stop[] = [];
  const finalVehicles = vehicles.map(vehicle => {
    const route = activeRoutes[vehicle.id];
    const { evaluatedStops, metrics } = evaluateRoute(
      route,
      vehicle,
      depot,
      trafficZones,
      config.trafficAware
    );

    finalStops.push(...evaluatedStops);

    return {
      ...vehicle,
      status: route.length > 0 ? ('Active' as const) : ('Idle' as const),
      metrics,
    };
  });

  // Any stops that couldn't be assigned (should be 0 because of our fallback)
  stops.forEach(s => {
    if (!finalStops.some(fs => fs.id === s.id)) {
      finalStops.push({
        ...s,
        assignedVehicleId: null,
        stopSequence: null,
        eta: null,
        arrivalTime: null,
        status: 'Pending',
      });
    }
  });

  return {
    optimizedStops: finalStops,
    optimizedVehicles: finalVehicles,
  };
}
