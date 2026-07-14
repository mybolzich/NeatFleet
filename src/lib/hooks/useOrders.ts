import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import type { Stop, Priority, StopStatus } from '../../types';

// Mirrors the Supabase `stops` table columns (snake_case)
interface StopRow {
  id: string;
  company_id: string;
  name: string;
  customer: string;
  x: number;
  y: number;
  lat: number | null;
  lng: number | null;
  address: string;
  volume: number;
  time_window_start: number;
  time_window_end: number;
  service_duration: number;
  priority: Priority;
  status: StopStatus;
  assigned_vehicle_id: string | null;
  stop_sequence: number | null;
  eta: number | null;
  arrival_time: number | null;
}

function rowToStop(row: StopRow): Stop {
  return {
    id: row.id,
    name: row.name,
    customer: row.customer,
    x: row.x,
    y: row.y,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    address: row.address,
    volume: row.volume,
    timeWindowStart: row.time_window_start,
    timeWindowEnd: row.time_window_end,
    serviceDuration: row.service_duration,
    priority: row.priority,
    status: row.status ?? 'Pending',
    assignedVehicleId: row.assigned_vehicle_id,
    stopSequence: row.stop_sequence,
    eta: row.eta,
    arrivalTime: row.arrival_time,
  };
}

function stopToRow(
  data: Omit<Stop, 'id' | 'status' | 'assignedVehicleId' | 'stopSequence' | 'eta' | 'arrivalTime'>,
  companyId: string
): Omit<StopRow, 'id'> {
  return {
    company_id: companyId,
    name: data.name,
    customer: data.customer,
    x: data.x,
    y: data.y,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    address: data.address,
    volume: data.volume,
    time_window_start: data.timeWindowStart,
    time_window_end: data.timeWindowEnd,
    service_duration: data.serviceDuration,
    priority: data.priority,
    status: 'Pending',
    assigned_vehicle_id: null,
    stop_sequence: null,
    eta: null,
    arrival_time: null,
  };
}

function partialToRow(updates: Partial<Stop>): Partial<StopRow> {
  const row: Partial<StopRow> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.customer !== undefined) row.customer = updates.customer;
  if (updates.x !== undefined) row.x = updates.x;
  if (updates.y !== undefined) row.y = updates.y;
  if (updates.lat !== undefined) row.lat = updates.lat ?? null;
  if (updates.lng !== undefined) row.lng = updates.lng ?? null;
  if (updates.address !== undefined) row.address = updates.address;
  if (updates.volume !== undefined) row.volume = updates.volume;
  if (updates.timeWindowStart !== undefined) row.time_window_start = updates.timeWindowStart;
  if (updates.timeWindowEnd !== undefined) row.time_window_end = updates.timeWindowEnd;
  if (updates.serviceDuration !== undefined) row.service_duration = updates.serviceDuration;
  if (updates.priority !== undefined) row.priority = updates.priority;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.assignedVehicleId !== undefined) row.assigned_vehicle_id = updates.assignedVehicleId;
  if (updates.stopSequence !== undefined) row.stop_sequence = updates.stopSequence;
  if (updates.eta !== undefined) row.eta = updates.eta;
  if (updates.arrivalTime !== undefined) row.arrival_time = updates.arrivalTime;
  return row;
}

export function useOrders(companyId: string | null) {
  const [orders, setOrders] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!companyId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    supabase
      .from('stops')
      .select('*')
      .eq('company_id', companyId)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setOrders((data as StopRow[]).map(rowToStop));
        }
        setLoading(false);
      });
  }, [companyId]);

  // Real-time subscription for cross-device sync
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`stops:company:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stops',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = rowToStop(payload.new as StopRow);
            setOrders((prev) =>
              // skip if already added optimistically
              prev.some((s) => s.id === incoming.id)
                ? prev
                : [...prev, incoming]
            );
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((s) =>
                s.id === payload.new.id ? rowToStop(payload.new as StopRow) : s
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const addOrder = useCallback(
    async (
      data: Omit<Stop, 'id' | 'status' | 'assignedVehicleId' | 'stopSequence' | 'eta' | 'arrivalTime'>
    ): Promise<Stop | null> => {
      if (!companyId) return null;

      const { data: inserted, error: err } = await supabase
        .from('stops')
        .insert(stopToRow(data, companyId))
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      const stop = rowToStop(inserted as StopRow);

      // Optimistic update — real-time will de-duplicate
      setOrders((prev) => [...prev, stop]);

      return stop;
    },
    [companyId]
  );

  const updateOrder = useCallback(
    async (id: string, updates: Partial<Stop>): Promise<boolean> => {
      const dbUpdates = partialToRow(updates);

      // Capture original before optimistic update so we can roll back
      let original: Stop | undefined;
      setOrders((prev) => {
        original = prev.find((s) => s.id === id);
        return prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
      });

      const { error: err } = await supabase
        .from('stops')
        .update(dbUpdates)
        .eq('id', id);

      if (err) {
        setError(err.message);
        if (original) {
          setOrders((prev) => prev.map((s) => (s.id === id ? original! : s)));
        }
        return false;
      }

      return true;
    },
    []
  );

  const deleteOrder = useCallback(async (id: string): Promise<boolean> => {
    // Capture the stop before removal so we can restore on failure
    let deleted: Stop | undefined;
    setOrders((prev) => {
      deleted = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });

    const { error: err } = await supabase.from('stops').delete().eq('id', id);

    if (err) {
      setError(err.message);
      if (deleted) {
        setOrders((prev) => [...prev, deleted!]);
      }
      return false;
    }

    return true;
  }, []);

  const clearAllOrders = useCallback(async (): Promise<boolean> => {
    if (!companyId) return false;

    // Capture current list for rollback
    let snapshot: Stop[] = [];
    setOrders((prev) => {
      snapshot = prev;
      return [];
    });

    const { error: err } = await supabase
      .from('stops')
      .delete()
      .eq('company_id', companyId);

    if (err) {
      setError(err.message);
      setOrders(snapshot);
      return false;
    }

    return true;
  }, [companyId]);

  return { orders, loading, error, addOrder, updateOrder, deleteOrder, clearAllOrders };
}
