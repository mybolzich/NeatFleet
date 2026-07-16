import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

interface RoutePlanRow {
  id: string;
  company_id: string;
  vehicle_id: string;
  service_date: string;
  status: 'built' | 'dispatched' | 'active' | 'completed';
  stop_count: number;
  dispatched_at: string | null;
}

export interface RoutePlan {
  id: string;
  vehicleId: string;
  serviceDate: string;
  status: 'built' | 'dispatched' | 'active' | 'completed';
  stopCount: number;
  dispatchedAt: string | null;
}

function rowToPlan(row: RoutePlanRow): RoutePlan {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    serviceDate: row.service_date,
    status: row.status,
    stopCount: row.stop_count,
    dispatchedAt: row.dispatched_at,
  };
}

export function useRoutePlans(companyId: string | null, serviceDate: string) {
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch for the given service date
  useEffect(() => {
    if (!companyId) {
      setRoutePlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    supabase
      .from('route_plans')
      .select('*')
      .eq('company_id', companyId)
      .eq('service_date', serviceDate)
      .then(({ data, error }) => {
        if (!error && data) {
          setRoutePlans((data as RoutePlanRow[]).map(rowToPlan));
        }
        setLoading(false);
      });
  }, [companyId, serviceDate]);

  // Real-time subscription for cross-device sync
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`route_plans:company:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'route_plans',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = rowToPlan(payload.new as RoutePlanRow);
            setRoutePlans((prev) =>
              prev.some((p) => p.id === incoming.id) ? prev : [...prev, incoming]
            );
          } else if (payload.eventType === 'UPDATE') {
            setRoutePlans((prev) =>
              prev.map((p) =>
                p.id === payload.new.id ? rowToPlan(payload.new as RoutePlanRow) : p
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setRoutePlans((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Upsert route plans for a list of vehicles (called after Build Routes)
  const buildPlans = useCallback(
    async (entries: { vehicleId: string; stopCount: number }[]): Promise<boolean> => {
      if (!companyId || entries.length === 0) return true;

      const rows = entries.map(({ vehicleId, stopCount }) => ({
        company_id: companyId,
        vehicle_id: vehicleId,
        service_date: serviceDate,
        status: 'built' as const,
        stop_count: stopCount,
        dispatched_at: null,
      }));

      const { error } = await supabase
        .from('route_plans')
        .upsert(rows, { onConflict: 'company_id,vehicle_id,service_date' });

      if (error) {
        console.error('[useRoutePlans] buildPlans error:', error);
        return false;
      }
      return true;
    },
    [companyId, serviceDate]
  );

  // Mark all today's plans as dispatched
  const dispatchPlans = useCallback(async (): Promise<boolean> => {
    if (!companyId) return false;

    const { error } = await supabase
      .from('route_plans')
      .update({ status: 'dispatched', dispatched_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('service_date', serviceDate)
      .eq('status', 'built');

    if (error) {
      console.error('[useRoutePlans] dispatchPlans error:', error);
      return false;
    }
    return true;
  }, [companyId, serviceDate]);

  // Delete all route plans for today (called on Reset)
  const clearPlans = useCallback(async (): Promise<boolean> => {
    if (!companyId) return false;

    setRoutePlans([]);

    const { error } = await supabase
      .from('route_plans')
      .delete()
      .eq('company_id', companyId)
      .eq('service_date', serviceDate);

    if (error) {
      console.error('[useRoutePlans] clearPlans error:', error);
      return false;
    }
    return true;
  }, [companyId, serviceDate]);

  return { routePlans, loading, buildPlans, dispatchPlans, clearPlans };
}
