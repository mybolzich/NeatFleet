import { useEffect, useRef, useState } from 'react';
import { Stop, Vehicle, Depot, TrafficZone } from '../types';

/**
 * Loads a company's fleet data from localStorage on login, and auto-saves
 * (debounced) whenever stops/vehicles/depot/trafficZones change.
 *
 * Uses localStorage for MVP — sufficient for single-user testing.
 * In production, would connect to Firestore.
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
  const storageKey = companyId ? `neatfleet_fleet_${companyId}` : null;

  // ── Load once when company becomes available ────────────────────
  useEffect(() => {
    if (!companyId || !storageKey) { setHydrated(false); return; }
    isFirstRun.current = true;

    try {
      console.log('[useCloudSync] Loading fleet data from localStorage');
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        console.log('[useCloudSync] Found saved data:', data);
        if (data.stops?.length) setStops(data.stops);
        if (data.vehicles?.length) setVehicles(data.vehicles);
        if (data.depot) setDepot(data.depot);
        if (data.trafficZones?.length) setTrafficZones(data.trafficZones);
      }
    } catch (e) {
      console.warn('[useCloudSync] Failed to load fleet data:', e);
    } finally {
      setHydrated(true);
      setTimeout(() => { isFirstRun.current = false; }, 500);
    }
  }, [companyId, storageKey]);

  // ── Debounced auto-save whenever fleet state changes ────────────
  useEffect(() => {
    if (!companyId || !hydrated || isFirstRun.current || !storageKey) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const snapshot = { stops, vehicles, depot, trafficZones };
        localStorage.setItem(storageKey, JSON.stringify(snapshot));
        console.log('[useCloudSync] Saved fleet snapshot to localStorage');
      } catch (e) {
        console.warn('[useCloudSync] Save failed:', e);
      }
    }, 1500);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [companyId, hydrated, stops, vehicles, depot, trafficZones, storageKey]);

  return { hydrated };
}
