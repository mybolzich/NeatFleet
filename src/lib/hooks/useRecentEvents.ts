import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface DispatchEvent {
  id: string;
  eventType: 'route_dispatched' | 'stop_completed' | 'route_completed';
  vehicleId: string | null;
  stopId: string | null;
  routePlanId: string | null;
  createdAt: string;
}

interface EventRow {
  id: string;
  event_type: 'route_dispatched' | 'stop_completed' | 'route_completed';
  vehicle_id: string | null;
  stop_id: string | null;
  route_plan_id: string | null;
  created_at: string;
}

function rowToEvent(row: EventRow): DispatchEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    vehicleId: row.vehicle_id,
    stopId: row.stop_id,
    routePlanId: row.route_plan_id,
    createdAt: row.created_at,
  };
}

export function useRecentEvents(companyId: string | null, limit = 30) {
  const [events, setEvents] = useState<DispatchEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string>(() => new Date().toISOString());

  useEffect(() => {
    if (!companyId) { setEvents([]); return; }

    supabase
      .from('dispatch_events')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (!error && data) {
          setEvents((data as EventRow[]).map(rowToEvent));
        }
      });
  }, [companyId, limit]);

  // Real-time: prepend new events as they arrive
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`dispatch_events:company:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispatch_events',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const incoming = rowToEvent(payload.new as EventRow);
          setEvents(prev => [incoming, ...prev].slice(0, limit));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, limit]);

  // Recompute unread whenever events or lastReadAt changes
  useEffect(() => {
    setUnreadCount(events.filter(e => e.createdAt > lastReadAt).length);
  }, [events, lastReadAt]);

  const markAllRead = () => setLastReadAt(new Date().toISOString());

  return { events, unreadCount, markAllRead };
}
