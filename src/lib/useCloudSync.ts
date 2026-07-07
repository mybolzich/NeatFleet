import { useEffect, useRef, useState } from 'react';
import { databases, DB_ID, COLLECTIONS, Query, ID } from './appwrite';
import { Stop, Vehicle, Depot, TrafficZone } from '../types';

/**
 * Loads a company's fleet data from Appwrite on login, and auto-saves
 * (debounced) whenever stops/vehicles/depot/trafficZones change.
 *
 * This intentionally does NOT touch NeatFleet's existing optimizer/mutation
 * handlers — it treats the whole fleet state as a snapshot to sync, so all
 * existing simulation logic keeps working exactly as before, just backed
 * by real persistence now instead of resetting on refresh.
 */
export function useCloudSync(
  companyId: string | null,
  stops: Stop[], setStops: (s: Stop[]) => void,
  vehicles: Vehicle[], setVehicles: (v: Vehicle[]) => void,
  depot: Depot, setDepot: (d: Depot) => void,
  trafficZones: TrafficZone[], setTrafficZones: (t: TrafficZone[]) => void,
) {
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  // ── Load once when company becomes available ────────────────────
  useEffect(() => {
    if (!companyId) { setHydrated(false); return; }
    isFirstRun.current = true;

    (async () => {
      try {
        const [stopsRes, vehiclesRes, depotRes, trafficRes] = await Promise.all([
          databases.listDocuments(DB_ID, COLLECTIONS.stops, [Query.equal('companyId', companyId), Query.limit(500)]),
          databases.listDocuments(DB_ID, COLLECTIONS.vehicles, [Query.equal('companyId', companyId), Query.limit(200)]),
          databases.listDocuments(DB_ID, COLLECTIONS.depots, [Query.equal('companyId', companyId), Query.limit(1)]),
          databases.listDocuments(DB_ID, COLLECTIONS.trafficZones, [Query.equal('companyId', companyId), Query.limit(200)]),
        ]);

        // Only overwrite the demo defaults if the company actually has saved data.
        // A brand-new company keeps NeatFleet's built-in demo scenario as a starting point.
        if (stopsRes.documents.length) {
          setStops(stopsRes.documents.map((d: any) => docToStop(d)));
        }
        if (vehiclesRes.documents.length) {
          setVehicles(vehiclesRes.documents.map((d: any) => docToVehicle(d)));
        }
        if (depotRes.documents.length) {
          const d: any = depotRes.documents[0];
          setDepot({ x: d.lat, y: d.lng, address: d.address || '' });
        }
        if (trafficRes.documents.length) {
          setTrafficZones(trafficRes.documents.map((d: any) => docToTraffic(d)));
        }
      } catch (e) {
        console.warn('[useCloudSync] Failed to load fleet data:', e);
      } finally {
        setHydrated(true);
        // Delay clearing isFirstRun so the hydration itself doesn't trigger an immediate re-save
        setTimeout(() => { isFirstRun.current = false; }, 500);
      }
    })();
  }, [companyId]);

  // ── Debounced auto-save whenever fleet state changes ────────────
  useEffect(() => {
    if (!companyId || !hydrated || isFirstRun.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveFleetSnapshot(companyId, stops, vehicles, depot, trafficZones).catch((e) =>
        console.warn('[useCloudSync] Save failed:', e)
      );
    }, 1500);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [companyId, hydrated, stops, vehicles, depot, trafficZones]);

  return { hydrated };
}

// ── Doc <-> app-type converters ─────────────────────────────────────
function docToStop(d: any): Stop {
  return {
    id: d.$id, name: d.name, customer: d.customer,
    x: d.lat, y: d.lng, address: d.address,
    volume: d.volume, timeWindowStart: d.timeWindowStart, timeWindowEnd: d.timeWindowEnd,
    serviceDuration: d.serviceDuration, priority: d.priority,
    status: d.status, assignedVehicleId: d.assignedVehicleId || null,
    stopSequence: d.stopSequence ?? null, eta: null, arrivalTime: null,
  };
}
function docToVehicle(d: any): Vehicle {
  return {
    id: d.$id, name: d.name, capacity: d.capacity,
    shiftStart: d.shiftStart, shiftEnd: d.shiftEnd,
    costPerMile: d.costPerMile, costPerHour: d.costPerHour,
    color: d.color, speed: d.speed, status: d.status,
    metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
  };
}
function docToTraffic(d: any): TrafficZone {
  return { id: d.$id, name: d.name, x: d.lat, y: d.lng, radius: d.radius, delayFactor: d.delayFactor };
}

// ── Save: diff-based upsert (create/update changed docs, delete removed) ──
async function saveFleetSnapshot(
  companyId: string,
  stops: Stop[], vehicles: Vehicle[], depot: Depot, trafficZones: TrafficZone[]
) {
  await Promise.all([
    syncCollection(COLLECTIONS.stops, companyId, stops, (s) => ({
      companyId, name: s.name, customer: s.customer, address: s.address,
      lat: s.x, lng: s.y, volume: s.volume,
      timeWindowStart: s.timeWindowStart, timeWindowEnd: s.timeWindowEnd,
      serviceDuration: s.serviceDuration, priority: s.priority, status: s.status,
      assignedVehicleId: s.assignedVehicleId || '', stopSequence: s.stopSequence ?? 0,
    })),
    syncCollection(COLLECTIONS.vehicles, companyId, vehicles, (v) => ({
      companyId, name: v.name, capacity: v.capacity,
      shiftStart: v.shiftStart, shiftEnd: v.shiftEnd,
      costPerMile: v.costPerMile, costPerHour: v.costPerHour,
      color: v.color, speed: v.speed, status: v.status,
    })),
    syncCollection(COLLECTIONS.trafficZones, companyId, trafficZones, (t) => ({
      companyId, name: t.name, lat: t.x, lng: t.y, radius: t.radius, delayFactor: t.delayFactor,
    })),
    saveDepot(companyId, depot),
  ]);
}

async function syncCollection<T extends { id: string }>(
  collectionId: string, companyId: string, items: T[], toFields: (item: T) => Record<string, any>
) {
  const existing = await databases.listDocuments(DB_ID, collectionId, [Query.equal('companyId', companyId), Query.limit(500)]);
  const existingIds = new Set(existing.documents.map((d: any) => d.$id));
  const currentIds = new Set(items.map((i) => i.id));

  const ops: Promise<any>[] = [];

  for (const item of items) {
    const fields = toFields(item);
    if (existingIds.has(item.id)) {
      ops.push(databases.updateDocument(DB_ID, collectionId, item.id, fields));
    } else {
      ops.push(databases.createDocument(DB_ID, collectionId, item.id, fields));
    }
  }
  for (const doc of existing.documents) {
    if (!currentIds.has((doc as any).$id)) {
      ops.push(databases.deleteDocument(DB_ID, collectionId, (doc as any).$id));
    }
  }
  await Promise.all(ops);
}

async function saveDepot(companyId: string, depot: Depot) {
  const existing = await databases.listDocuments(DB_ID, COLLECTIONS.depots, [Query.equal('companyId', companyId), Query.limit(1)]);
  const fields = { companyId, lat: depot.x, lng: depot.y, address: depot.address };
  if (existing.documents.length) {
    await databases.updateDocument(DB_ID, COLLECTIONS.depots, (existing.documents[0] as any).$id, fields);
  } else {
    await databases.createDocument(DB_ID, COLLECTIONS.depots, ID.unique(), fields);
  }
}
