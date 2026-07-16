import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import type { Vehicle, VehicleStatus, VehicleMetrics } from '../../types';

// Mirrors the Supabase `vehicles` table columns (snake_case)
interface VehicleRow {
  id: string;
  company_id: string;
  name: string;
  capacity: number;
  shift_start: number;
  shift_end: number;
  cost_per_mile: number;
  cost_per_hour: number;
  color: string;
  speed: number;
  status: VehicleStatus;
  metrics: VehicleMetrics;
}

const EMPTY_METRICS: VehicleMetrics = {
  totalDistance: 0,
  totalTime: 0,
  loadUsed: 0,
  delayCount: 0,
  totalCost: 0,
};

function rowToVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    shiftStart: row.shift_start,
    shiftEnd: row.shift_end,
    costPerMile: row.cost_per_mile,
    costPerHour: row.cost_per_hour,
    color: row.color,
    speed: row.speed,
    status: row.status ?? 'Idle',
    metrics: row.metrics ?? EMPTY_METRICS,
  };
}

function vehicleToRow(
  data: Omit<Vehicle, 'id' | 'status' | 'metrics'>,
  companyId: string
): Omit<VehicleRow, 'id'> {
  return {
    company_id: companyId,
    name: data.name,
    capacity: data.capacity,
    shift_start: data.shiftStart,
    shift_end: data.shiftEnd,
    cost_per_mile: data.costPerMile,
    cost_per_hour: data.costPerHour,
    color: data.color,
    speed: data.speed,
    status: 'Idle',
    metrics: EMPTY_METRICS,
  };
}

function partialToRow(updates: Partial<Vehicle>): Partial<VehicleRow> {
  const row: Partial<VehicleRow> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.capacity !== undefined) row.capacity = updates.capacity;
  if (updates.shiftStart !== undefined) row.shift_start = updates.shiftStart;
  if (updates.shiftEnd !== undefined) row.shift_end = updates.shiftEnd;
  if (updates.costPerMile !== undefined) row.cost_per_mile = updates.costPerMile;
  if (updates.costPerHour !== undefined) row.cost_per_hour = updates.costPerHour;
  if (updates.color !== undefined) row.color = updates.color;
  if (updates.speed !== undefined) row.speed = updates.speed;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.metrics !== undefined) row.metrics = updates.metrics;
  return row;
}

export function useVehicles(companyId: string | null) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!companyId) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    supabase
      .from('vehicles')
      .select('*')
      .eq('company_id', companyId)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setVehicles((data as VehicleRow[]).map(rowToVehicle));
        }
        setLoading(false);
      });
  }, [companyId]);

  // Real-time subscription for cross-device sync
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`vehicles:company:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicles',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = rowToVehicle(payload.new as VehicleRow);
            setVehicles((prev) =>
              // skip if already added optimistically
              prev.some((v) => v.id === incoming.id)
                ? prev
                : [...prev, incoming]
            );
          } else if (payload.eventType === 'UPDATE') {
            setVehicles((prev) =>
              prev.map((v) =>
                v.id === payload.new.id ? rowToVehicle(payload.new as VehicleRow) : v
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setVehicles((prev) => prev.filter((v) => v.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const addVehicle = useCallback(
    async (data: Omit<Vehicle, 'id' | 'status' | 'metrics'>): Promise<Vehicle | null> => {
      if (!companyId) return null;

      const { data: inserted, error: err } = await supabase
        .from('vehicles')
        .insert(vehicleToRow(data, companyId))
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      const vehicle = rowToVehicle(inserted as VehicleRow);

      // Optimistic update — real-time will de-duplicate
      setVehicles((prev) => [...prev, vehicle]);

      return vehicle;
    },
    [companyId]
  );

  const updateVehicle = useCallback(
    async (id: string, updates: Partial<Vehicle>): Promise<boolean> => {
      const dbUpdates = partialToRow(updates);

      // Capture original before optimistic update so we can roll back
      let original: Vehicle | undefined;
      setVehicles((prev) => {
        original = prev.find((v) => v.id === id);
        return prev.map((v) => (v.id === id ? { ...v, ...updates } : v));
      });

      const { error: err } = await supabase
        .from('vehicles')
        .update(dbUpdates)
        .eq('id', id);

      if (err) {
        setError(err.message);
        if (original) {
          setVehicles((prev) => prev.map((v) => (v.id === id ? original! : v)));
        }
        return false;
      }

      return true;
    },
    []
  );

  const deleteVehicle = useCallback(async (id: string): Promise<boolean> => {
    // Capture the vehicle before removal so we can restore on failure
    let deleted: Vehicle | undefined;
    setVehicles((prev) => {
      deleted = prev.find((v) => v.id === id);
      return prev.filter((v) => v.id !== id);
    });

    const { error: err } = await supabase.from('vehicles').delete().eq('id', id);

    if (err) {
      setError(err.message);
      if (deleted) {
        setVehicles((prev) => [...prev, deleted!]);
      }
      return false;
    }

    return true;
  }, []);

  return { vehicles, loading, error, addVehicle, updateVehicle, deleteVehicle };
}
