import { useCallback } from 'react';
import { supabase } from '../supabase';

export type DispatchEventType = 'route_dispatched' | 'stop_completed' | 'route_completed';

export interface LogEventArgs {
  eventType: DispatchEventType;
  vehicleId?: string;
  stopId?: string;
  routePlanId?: string;
}

export function useDispatchEvents(companyId: string | null) {
  const logEvent = useCallback(
    async ({ eventType, vehicleId, stopId, routePlanId }: LogEventArgs): Promise<void> => {
      if (!companyId) return;
      const { error } = await supabase.from('dispatch_events').insert({
        company_id: companyId,
        event_type: eventType,
        vehicle_id: vehicleId ?? null,
        stop_id: stopId ?? null,
        route_plan_id: routePlanId ?? null,
      });
      if (error) console.error('[useDispatchEvents] logEvent error:', error);
    },
    [companyId]
  );

  return { logEvent };
}
