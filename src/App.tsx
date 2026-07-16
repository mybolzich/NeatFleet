import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck, MapPin, Download, Calendar,
  Play, CheckCircle2, Send, RotateCcw,
  ChevronDown, ChevronRight, GripVertical, Trash2,
  AlertTriangle, Clock, Package, LogOut,
  Layers, Settings, Route, Bell, X,
  Navigation2, CheckSquare,
} from 'lucide-react';
import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig } from './types';
import { getOptimizationProvider } from './lib/providers/optimization';
import { generatePreset } from './utils/presets';
import type { PresetKey } from './utils/presets';
import { InteractiveMap } from './components/InteractiveMap';
import { OrderBook } from './components/OrderBook';
import { FleetManager } from './components/FleetManager';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { AuthScreen } from './components/AuthScreen';
import { useAuth } from './lib/useAuth';
import { useVehicles } from './lib/hooks/useVehicles';
import { useOrders } from './lib/hooks/useOrders';
import { useRoutePlans } from './lib/hooks/useRoutePlans';
import type { RoutePlan } from './lib/hooks/useRoutePlans';
import { useDispatchEvents } from './lib/hooks/useDispatchEvents';
import { useRecentEvents } from './lib/hooks/useRecentEvents';
import type { DispatchEvent } from './lib/hooks/useRecentEvents';

// ── Constants ─────────────────────────────────────────────────────────────
const CENTRAL_DEPOT: Depot = {
  x: 50, y: 50,
  lat: 28.1518, lng: -82.3743,
  address: 'Tampa, FL (Cornerstone Dispatch)'
};

const CREW_COLORS = ['#38bdf8','#fb7185','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16'];

const INITIAL_VEHICLES: Vehicle[] = [
  { id: 'v1', name: 'Crew LM1 — Neri',    capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[0], speed: 1.6, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v2', name: 'Crew LM2 — Mateos',  capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[1], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v3', name: 'Crew LM3 — Erick',   capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[2], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v4', name: 'Crew LM4 — Luis',    capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[3], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v5', name: 'Crew LM5 — Mario',   capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[4], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
];

const INITIAL_TRAFFIC: TrafficZone[] = [];

type AppTab = 'orders' | 'routes' | 'fleet' | 'settings';
type RouteStatus = 'unbuilt' | 'built' | 'dispatched';

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtTime = (mins: number) => {
  const h = Math.floor(mins / 60) + 8;
  const m = mins % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${String(h > 12 ? h - 12 : h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
};

const today = () => new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();

  const companyId = auth.company?.id ?? null;
  const { orders: stops, loading: stopsLoading, addOrder, updateOrder, deleteOrder, clearAllOrders } = useOrders(companyId);
  const { vehicles, loading: vehiclesLoading, addVehicle, updateVehicle, deleteVehicle } = useVehicles(companyId);

  const [depot]                     = useState<Depot>(CENTRAL_DEPOT);
  const [trafficZones]              = useState<TrafficZone[]>(INITIAL_TRAFFIC);
  const [config, setConfig]         = useState<OptimizerConfig>({ minimizeVehicles: false, timeWindowWeight: 4, capacityWeight: 5, trafficAware: true });

  const [tab, setTab]               = useState<AppTab>('orders');
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('unbuilt');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [expandedCrews, setExpandedCrews] = useState<Set<string>>(new Set());
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [building, setBuilding]     = useState(false);
  const [optimizerBackend, setOptimizerBackend] = useState<'or-tools' | 'heuristic' | null>(null);

  const { routePlans, buildPlans, dispatchVehicle, dispatchPlans, clearPlans } = useRoutePlans(companyId, serviceDate);
  const { logEvent } = useDispatchEvents(companyId);
  const { events: recentEvents, unreadCount, markAllRead } = useRecentEvents(companyId);
  const [busyVehicleId, setBusyVehicleId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  // Restore route status from persisted plans after initial data load
  const routeStatusInitialized = useRef(false);
  useEffect(() => {
    if (vehiclesLoading || stopsLoading || routeStatusInitialized.current) return;
    routeStatusInitialized.current = true;
    if (routePlans.some(p => p.status === 'dispatched')) {
      setRouteStatus('dispatched');
    } else if (stops.some(s => s.assignedVehicleId !== null)) {
      setRouteStatus('built');
    }
  }, [vehiclesLoading, stopsLoading, routePlans, stops]);

  // ── Stop CRUD ────────────────────────────────────────────────────────────
  const handleAddStop = useCallback(async (newStop: Omit<Stop,'id'|'status'|'assignedVehicleId'|'stopSequence'|'eta'|'arrivalTime'>) => {
    await addOrder(newStop);
    setRouteStatus('unbuilt');
  }, [addOrder]);

  const handleDeleteStop = useCallback(async (id: string) => {
    await deleteOrder(id);
    if (selectedStopId === id) setSelectedStopId(null);
    setRouteStatus('unbuilt');
  }, [selectedStopId, deleteOrder]);

  const handleClearAllStops = useCallback(async () => {
    await clearAllOrders();
    setRouteStatus('unbuilt');
  }, [clearAllOrders]);

  const handleLoadPreset = useCallback(async (key: string) => {
    await clearAllOrders();
    const presetStops = generatePreset(key as PresetKey);
    for (const s of presetStops) {
      await addOrder(s);
    }
    await clearPlans();
    setRouteStatus('unbuilt');
  }, [clearAllOrders, addOrder, clearPlans]);

  const handleMapClickAdd = useCallback(async (x: number, y: number) => {
    const stop = await addOrder({
      name: `Stop ${stops.length + 1}`,
      customer: 'New Customer',
      x, y,
      address: 'Address pending',
      volume: 10,
      timeWindowStart: 0,
      timeWindowEnd: 480,
      serviceDuration: 20,
      priority: 'Medium',
    });
    if (stop) {
      setSelectedStopId(stop.id);
      setTab('orders');
    }
    setRouteStatus('unbuilt');
  }, [stops.length, addOrder]);

  const handleUpdateStopCoords = useCallback(async (id: string, x: number, y: number) => {
    await updateOrder(id, { x, y });
    setRouteStatus('unbuilt');
  }, [updateOrder]);

  // ── Vehicle CRUD ─────────────────────────────────────────────────────────
  const handleAddVehicle = useCallback(async (v: Omit<Vehicle,'id'|'status'|'metrics'>) => {
    await addVehicle(v);
  }, [addVehicle]);

  const handleUpdateVehicle = useCallback(async (id: string, updates: Partial<Vehicle>) => {
    await updateVehicle(id, updates);
  }, [updateVehicle]);

  const handleDeleteVehicle = useCallback(async (id: string) => {
    await deleteVehicle(id);
  }, [deleteVehicle]);

  // ── Build Routes ─────────────────────────────────────────────────────────
  const handleBuildRoutes = useCallback(async () => {
    if (stops.length === 0) return;
    setBuilding(true);
    const { optimizedStops, optimizedVehicles, backend } =
      await getOptimizationProvider().optimizeRoutesWithBackend(stops, vehicles, depot, trafficZones, config);
    setOptimizerBackend(backend);
    await Promise.all([
      ...optimizedStops.map(s => updateOrder(s.id, {
        assignedVehicleId: s.assignedVehicleId,
        stopSequence: s.stopSequence,
        eta: s.eta,
        arrivalTime: s.arrivalTime,
        status: s.status,
      })),
      ...optimizedVehicles.map(v => updateVehicle(v.id, { status: v.status, metrics: v.metrics })),
    ]);

    // Persist route plan entries for each vehicle that got stops assigned
    const planEntries = optimizedVehicles
      .filter(v => optimizedStops.some(s => s.assignedVehicleId === v.id))
      .map(v => ({
        vehicleId: v.id,
        stopCount: optimizedStops.filter(s => s.assignedVehicleId === v.id).length,
      }));
    await buildPlans(planEntries);

    setRouteStatus('built');
    setTab('routes');
    setBuilding(false);
    const withStops = new Set(optimizedStops.filter(s => s.assignedVehicleId).map(s => s.assignedVehicleId!));
    setExpandedCrews(withStops);
  }, [stops, vehicles, depot, trafficZones, config, updateOrder, updateVehicle]);

  // ── Dispatch ─────────────────────────────────────────────────────────────
  const handleDispatch = useCallback(async () => {
    if (routeStatus !== 'built') return;
    setRouteStatus('dispatched');
    await Promise.all([
      dispatchPlans(),
      ...vehicles.filter(v => v.metrics.loadUsed > 0).map(v => updateVehicle(v.id, { status: 'Active' })),
      ...stops.filter(s => s.assignedVehicleId).map(s => updateOrder(s.id, { status: 'In Transit' })),
    ]);
  }, [routeStatus, vehicles, stops, updateVehicle, updateOrder, dispatchPlans]);

  // ── Dispatch single vehicle ──────────────────────────────────────────────
  const handleDispatchVehicle = useCallback(async (vehicleId: string) => {
    if (busyVehicleId) return;
    setBusyVehicleId(vehicleId);

    const plan = routePlans.find(p => p.vehicleId === vehicleId);
    const vehicleStops = stops.filter(s => s.assignedVehicleId === vehicleId);

    await Promise.all([
      dispatchVehicle(vehicleId),
      updateVehicle(vehicleId, { status: 'Active' }),
      ...vehicleStops.map(s => updateOrder(s.id, { status: 'In Transit' })),
      logEvent({ vehicleId, routePlanId: plan?.id, eventType: 'route_dispatched' }),
    ]);

    // Transition to global dispatched when all active vehicles are dispatched
    const activeVehicleIds = new Set(stops.filter(s => s.assignedVehicleId).map(s => s.assignedVehicleId!));
    const alreadyDispatched = new Set([
      ...routePlans.filter(p => p.status === 'dispatched').map(p => p.vehicleId),
      vehicleId,
    ]);
    if ([...activeVehicleIds].every(vid => alreadyDispatched.has(vid))) {
      setRouteStatus('dispatched');
    }

    setBusyVehicleId(null);
  }, [busyVehicleId, routePlans, stops, dispatchVehicle, updateVehicle, updateOrder, logEvent]);

  // ── Mark stop completed (Live Ops) ────────────────────────────────────────
  const handleMarkCompleted = useCallback(async (stopId: string) => {
    const stop = stops.find(s => s.id === stopId);
    if (!stop || stop.status === 'Completed') return;

    await Promise.all([
      updateOrder(stopId, { status: 'Completed' }),
      logEvent({
        stopId,
        vehicleId: stop.assignedVehicleId ?? undefined,
        eventType: 'stop_completed',
      }),
    ]);

    // If all stops for this vehicle are now complete, log route_completed + set Returning
    if (stop.assignedVehicleId) {
      const vehicleStops = stops.filter(s => s.assignedVehicleId === stop.assignedVehicleId);
      const allDone = vehicleStops.every(s => s.id === stopId || s.status === 'Completed');
      if (allDone) {
        const plan = routePlans.find(p => p.vehicleId === stop.assignedVehicleId);
        await Promise.all([
          updateVehicle(stop.assignedVehicleId, { status: 'Returning' }),
          logEvent({ vehicleId: stop.assignedVehicleId, routePlanId: plan?.id, eventType: 'route_completed' }),
        ]);
      }
    }
  }, [stops, routePlans, updateOrder, updateVehicle, logEvent]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    await Promise.all([
      clearPlans(),
      ...stops.map(s => updateOrder(s.id, {
        assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null, status: 'Pending',
      })),
      ...vehicles.map(v => updateVehicle(v.id, {
        status: 'Idle',
        metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
      })),
    ]);
    setRouteStatus('unbuilt');
  }, [stops, vehicles, updateOrder, updateVehicle, clearPlans]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const header = 'Crew,Stop #,Customer,Address,Arrival,Window Open,Window Close,Service (min),Status\n';
    const rows = vehicles.flatMap(v => {
      const assigned = stops
        .filter(s => s.assignedVehicleId === v.id)
        .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));
      return assigned.map((s, i) =>
        `"${v.name}",${i+1},"${s.customer}","${s.address}",${s.eta !== null ? fmtTime(s.eta) : 'TBD'},${fmtTime(s.timeWindowStart)},${fmtTime(s.timeWindowEnd)},${s.serviceDuration},${s.status}`
      );
    });
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `route_${serviceDate}.csv`;
    a.click();
  }, [stops, vehicles, serviceDate]);

  // ── Drag-reorder stop between crews ──────────────────────────────────────
  const dragStopRef = useRef<{ stopId: string; fromVehicleId: string | null } | null>(null);

  const handleDragStart = (stopId: string, fromVehicleId: string | null) => {
    dragStopRef.current = { stopId, fromVehicleId };
  };

  const handleDropOnVehicle = async (toVehicleId: string) => {
    if (!dragStopRef.current) return;
    const { stopId } = dragStopRef.current;
    dragStopRef.current = null;
    await updateOrder(stopId, { assignedVehicleId: toVehicleId });
    if (routeStatus === 'dispatched') setRouteStatus('built');
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const assignedCount = stops.filter(s => s.assignedVehicleId).length;
  const unassignedCount = stops.length - assignedCount;
  const completedCount = stops.filter(s => s.status === 'Completed').length;
  const activeCrews = vehicles.filter(v => stops.some(s => s.assignedVehicleId === v.id)).length;

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (auth.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading NeatFleet...</p>
        </div>
      </div>
    );
  }

  if (!auth.authUser || !auth.profile || !auth.company) {
    return <AuthScreen auth={auth} />;
  }

  if (stopsLoading || vehiclesLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading fleet data...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">

      {/* ── TOP HEADER BAR ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm z-20 gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 tracking-tight">NeatFleet</div>
            <div className="text-[10px] text-slate-400 font-medium">{auth.company.name}</div>
          </div>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="date"
            value={serviceDate}
            onChange={e => { setServiceDate(e.target.value); handleReset(); }}
            className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
          />
        </div>

        {/* KPI strip */}
        <div className="hidden md:flex items-center gap-4">
          <Kpi icon={<Package className="w-3.5 h-3.5 text-blue-500" />}
            label="Orders" value={String(stops.length)} sub="total" />
          <Kpi icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            label="Unassigned" value={String(unassignedCount)} sub="stops"
            alert={unassignedCount > 0} />
          <Kpi icon={<Truck className="w-3.5 h-3.5 text-slate-400" />}
            label="Crew" value={`${activeCrews} / ${vehicles.length}`} sub="active" />
          {routeStatus !== 'unbuilt' && (
            <Kpi icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              label="Completed" value={`${completedCount} / ${assignedCount}`} sub="stops"
              success={completedCount > 0} />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {routeStatus === 'unbuilt' && (
            <button onClick={handleBuildRoutes} disabled={stops.length === 0 || building}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition shadow-sm cursor-pointer">
              {building
                ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Building...</>
                : <><Play className="w-3.5 h-3.5" /> Build Routes</>}
            </button>
          )}
          {routeStatus === 'built' && (
            <button onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" /> Rebuild
            </button>
          )}
          {routeStatus === 'dispatched' && (
            <>
              <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
              </span>
              <button onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </>
          )}

          <button onClick={handleExportCSV} disabled={stops.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition cursor-pointer">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            {/* Activity bell */}
            <button
              onClick={() => { setActivityOpen(o => !o); if (!activityOpen) markAllRead(); }}
              className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Activity feed">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <div className="text-right hidden md:block">
              <div className="text-[11px] font-bold text-slate-800">{auth.profile.fullName}</div>
              <div className="text-[10px] text-slate-400 capitalize">{auth.profile.role}</div>
            </div>
            <button onClick={auth.logout}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
        <aside className="w-[340px] shrink-0 flex flex-col bg-white border-r border-slate-200 z-10">
          {/* Tab nav */}
          <div className="flex border-b border-slate-200">
            {([
              ['orders', MapPin, 'Orders'],
              ['routes', Layers, 'Routes'],
              ['fleet',  Truck,  'Crew'],
              ['settings', Settings, 'Solver'],
            ] as const).map(([id, Icon, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex flex-col items-center py-2.5 text-[10px] font-bold transition border-b-2 cursor-pointer ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                <Icon className="w-4 h-4 mb-0.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {tab === 'orders' && (
              <OrderBook
                stops={stops}
                onAddStop={handleAddStop}
                onDeleteStop={handleDeleteStop}
                onLoadPreset={handleLoadPreset}
                selectedStopId={selectedStopId}
                onSelectStop={setSelectedStopId}
                onClearAllStops={handleClearAllStops}
                dispatchLat={auth.company?.dispatchLat ?? depot.lat}
                dispatchLng={auth.company?.dispatchLng ?? depot.lng}
              />
            )}

            {tab === 'routes' && (
              <RoutesPanel
                stops={stops}
                vehicles={vehicles}
                routeStatus={routeStatus}
                routePlans={routePlans}
                expandedCrews={expandedCrews}
                onToggleCrew={(id) => setExpandedCrews(prev => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })}
                selectedStopId={selectedStopId}
                onSelectStop={setSelectedStopId}
                onSelectVehicle={setSelectedVehicleId}
                onDeleteStop={handleDeleteStop}
                onDragStart={handleDragStart}
                onDropOnVehicle={handleDropOnVehicle}
                onBuildRoutes={handleBuildRoutes}
                building={building}
                onDispatchVehicle={handleDispatchVehicle}
                onDispatchAll={handleDispatch}
                onMarkCompleted={handleMarkCompleted}
                busyVehicleId={busyVehicleId}
              />
            )}

            {tab === 'fleet' && (
              <FleetManager
                vehicles={vehicles}
                onAddVehicle={handleAddVehicle}
                onUpdateVehicle={handleUpdateVehicle}
                onDeleteVehicle={handleDeleteVehicle}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
              />
            )}

            {tab === 'settings' && (
              <AnalyticsPanel
                vehicles={vehicles}
                stops={stops}
                config={config}
                onUpdateConfig={setConfig}
                onOptimize={handleBuildRoutes}
              />
            )}
          </div>
        </aside>

        {/* ── MAP (center) ───────────────────────────────────────────────────── */}
        <main className="flex-1 relative overflow-hidden">
          {/* Status bar over map */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <StatusBadge status={routeStatus} />
              {routeStatus === 'unbuilt' && stops.length > 0 && (
                <span className="text-[10px] bg-white/90 border border-slate-200 text-slate-500 px-2 py-1 rounded-lg shadow-sm">
                  {stops.length} stop{stops.length !== 1 ? 's' : ''} ready to route
                </span>
              )}
              {routeStatus !== 'unbuilt' && optimizerBackend && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm border ${
                  optimizerBackend === 'or-tools'
                    ? 'bg-white/90 border-emerald-200 text-emerald-700'
                    : 'bg-white/90 border-amber-200 text-amber-700'
                }`} title={optimizerBackend === 'heuristic' ? 'OR-Tools solver unavailable — used local fallback heuristic' : 'Solved with Google OR-Tools'}>
                  {optimizerBackend === 'or-tools' ? 'OR-Tools solver' : 'Local heuristic (fallback)'}
                </span>
              )}
            </div>
          </div>

          <InteractiveMap
            stops={stops}
            vehicles={vehicles}
            depot={depot}
            trafficZones={trafficZones}
            simulationTime={0}
            isSimulationRunning={false}
            onAddStop={handleMapClickAdd}
            onUpdateStopCoordinates={handleUpdateStopCoords}
            selectedStopId={selectedStopId}
            onSelectStop={setSelectedStopId}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
          />
        </main>

        {/* ── ACTIVITY DRAWER ──────────────────────────────────────────────── */}
        {activityOpen && (
          <ActivityPanel
            events={recentEvents}
            vehicles={vehicles}
            stops={stops}
            onClose={() => setActivityOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Kpi({ icon, label, value, sub, alert, success }: { icon: React.ReactNode; label: string; value: string; sub: string; alert?: boolean; success?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${alert ? 'bg-amber-50 border-amber-200' : success ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      {icon}
      <div>
        <div className={`text-xs font-bold ${alert ? 'text-amber-700' : success ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</div>
        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">{sub}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RouteStatus }) {
  if (status === 'unbuilt') return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold bg-white/95 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg shadow-sm">
      <span className="w-2 h-2 rounded-full bg-slate-300" /> Planning Mode
    </span>
  );
  if (status === 'built') return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold bg-white/95 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg shadow-sm">
      <span className="w-2 h-2 rounded-full bg-blue-500" /> Routes Built — Ready to Dispatch
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold bg-white/95 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg shadow-sm">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Routes Dispatched
    </span>
  );
}

// ── Routes Panel ──────────────────────────────────────────────────────────
interface RoutesPanelProps {
  stops: Stop[];
  vehicles: Vehicle[];
  routeStatus: RouteStatus;
  routePlans: RoutePlan[];
  expandedCrews: Set<string>;
  onToggleCrew: (id: string) => void;
  selectedStopId: string | null;
  onSelectStop: (id: string | null) => void;
  onSelectVehicle: (id: string | null) => void;
  onDeleteStop: (id: string) => void;
  onDragStart: (stopId: string, vehicleId: string | null) => void;
  onDropOnVehicle: (vehicleId: string) => void;
  onBuildRoutes: () => void;
  building: boolean;
  onDispatchVehicle: (vehicleId: string) => void;
  onDispatchAll: () => void;
  onMarkCompleted: (stopId: string) => void;
  busyVehicleId: string | null;
}

function RoutesPanel({
  stops, vehicles, routeStatus, routePlans, expandedCrews, onToggleCrew,
  selectedStopId, onSelectStop, onSelectVehicle,
  onDeleteStop, onDragStart, onDropOnVehicle, onBuildRoutes, building,
  onDispatchVehicle, onDispatchAll, onMarkCompleted, busyVehicleId,
}: RoutesPanelProps) {

  const unassigned = stops.filter(s => !s.assignedVehicleId);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const undispatchedActiveVehicles = vehicles.filter(v =>
    stops.some(s => s.assignedVehicleId === v.id) &&
    (routePlans.find(p => p.vehicleId === v.id)?.status ?? 'built') === 'built'
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">Route Plan</h2>
        {routeStatus === 'unbuilt' && (
          <button onClick={onBuildRoutes} disabled={stops.length === 0 || building}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition cursor-pointer">
            {building ? 'Building...' : <><Play className="w-3 h-3" /> Build</>}
          </button>
        )}
        {routeStatus === 'built' && undispatchedActiveVehicles.length > 0 && (
          <button onClick={onDispatchAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer">
            <Send className="w-3 h-3" /> Dispatch All
          </button>
        )}
        {routeStatus === 'dispatched' && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
            ✓ All Dispatched
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Unassigned stops — hidden once fully dispatched */}
        {unassigned.length > 0 && routeStatus !== 'dispatched' && (
          <div className="border-b border-slate-100 bg-amber-50/50">
            <div className="flex items-center gap-2 px-4 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-bold text-amber-700">Unassigned ({unassigned.length})</span>
            </div>
            {unassigned.map(stop => (
              <StopRow key={stop.id} stop={stop} vehicle={null}
                selected={selectedStopId === stop.id}
                onSelect={() => onSelectStop(stop.id)}
                onDelete={() => onDeleteStop(stop.id)}
                onDragStart={() => onDragStart(stop.id, null)}
              />
            ))}
          </div>
        )}

        {/* Per-vehicle route sections */}
        {vehicles.map(v => {
          const crewStops = stops
            .filter(s => s.assignedVehicleId === v.id)
            .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));
          const plan = routePlans.find(p => p.vehicleId === v.id);
          const isDispatched = plan?.status === 'dispatched' || plan?.status === 'active' || plan?.status === 'completed';
          const expanded = expandedCrews.has(v.id);
          const completedStops = crewStops.filter(s => s.status === 'Completed').length;
          const isDragTarget = dragOver === v.id;

          return (
            <div key={v.id}
              className={`border-b border-slate-100 transition ${isDragTarget ? 'bg-blue-50' : ''}`}
              onDragOver={isDispatched ? undefined : (e) => { e.preventDefault(); setDragOver(v.id); }}
              onDragLeave={isDispatched ? undefined : () => setDragOver(null)}
              onDrop={isDispatched ? undefined : () => { setDragOver(null); onDropOnVehicle(v.id); }}>

              {/* Crew header row */}
              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition">
                <button
                  onClick={() => { onToggleCrew(v.id); onSelectVehicle(v.id); }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                  <span className="flex-1 text-xs font-bold text-slate-800 truncate">{v.name}</span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 shrink-0">
                    {isDispatched && crewStops.length > 0 && (
                      <span className="font-mono text-emerald-600 font-bold">{completedStops}/{crewStops.length}</span>
                    )}
                    {!isDispatched && <span className="font-mono">{crewStops.length} stops</span>}
                    {v.metrics.totalTime > 0 && (
                      <span className="font-mono">{Math.round(v.metrics.totalTime / 60 * 10) / 10}h</span>
                    )}
                  </div>
                </button>

                {/* Per-vehicle dispatch controls */}
                {routeStatus === 'built' && crewStops.length > 0 && (
                  isDispatched ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => onDispatchVehicle(v.id)}
                      disabled={!!busyVehicleId}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition cursor-pointer shrink-0">
                      {busyVehicleId === v.id
                        ? <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                        : <><Send className="w-2.5 h-2.5" /> Dispatch</>}
                    </button>
                  )
                )}

                <button
                  onClick={() => { onToggleCrew(v.id); onSelectVehicle(v.id); }}
                  className="cursor-pointer shrink-0 ml-1">
                  {expanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>

              {/* Stop list */}
              {expanded && (
                <div className="pb-1">
                  {crewStops.length === 0 ? (
                    <p className="text-[10px] text-slate-400 px-10 py-2 italic">
                      {routeStatus === 'unbuilt' ? 'Drag stops here or build routes' : 'No stops assigned'}
                    </p>
                  ) : isDispatched ? (
                    crewStops.map((stop, idx) => (
                      <LiveStopRow key={stop.id} stop={stop} vehicle={v} index={idx}
                        selected={selectedStopId === stop.id}
                        onSelect={() => onSelectStop(stop.id)}
                        onMarkCompleted={() => onMarkCompleted(stop.id)}
                      />
                    ))
                  ) : (
                    crewStops.map((stop, idx) => (
                      <StopRow key={stop.id} stop={stop} vehicle={v} index={idx}
                        selected={selectedStopId === stop.id}
                        onSelect={() => onSelectStop(stop.id)}
                        onDelete={() => onDeleteStop(stop.id)}
                        onDragStart={() => onDragStart(stop.id, v.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stop Row (planning view — draggable) ─────────────────────────────────
function StopRow({ stop, vehicle, index, selected, onSelect, onDelete, onDragStart }: {
  stop: Stop; vehicle: Vehicle | null; index?: number;
  selected: boolean; onSelect: () => void; onDelete: () => void; onDragStart: () => void;
  key?: string;
}) {
  const isDelayed = stop.arrivalTime !== null && stop.arrivalTime > stop.timeWindowEnd;
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(); }}
      onClick={onSelect}
      className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition text-xs ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
      <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 cursor-grab" />
      {index !== undefined && (
        <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 text-white"
          style={{ backgroundColor: vehicle?.color ?? '#94a3b8' }}>
          {index + 1}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-800 truncate">{stop.name}</div>
        <div className="text-[10px] text-slate-400 truncate">{stop.address}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {stop.eta !== null && (
          <span className={`text-[10px] font-mono font-bold ${isDelayed ? 'text-red-500' : 'text-slate-500'}`}>
            {fmtTime(stop.eta)}
          </span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-slate-300 hover:text-red-500 transition cursor-pointer">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Live Stop Row (dispatched view — mark complete) ───────────────────────
function LiveStopRow({ stop, vehicle, index, selected, onSelect, onMarkCompleted }: {
  stop: Stop; vehicle: Vehicle; index: number;
  selected: boolean; onSelect: () => void; onMarkCompleted: () => void;
  key?: string;
}) {
  const isCompleted = stop.status === 'Completed';
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition text-xs ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'} ${isCompleted ? 'opacity-60' : ''}`}>
      <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 text-white"
        style={{ backgroundColor: vehicle.color }}>
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold truncate ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {stop.name}
        </div>
        <div className="text-[10px] text-slate-400 truncate">{stop.customer}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {stop.eta !== null && (
          <span className="text-[10px] font-mono text-slate-400">{fmtTime(stop.eta)}</span>
        )}
        {isCompleted ? (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 px-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkCompleted(); }}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer">
            <CheckCircle2 className="w-3 h-3" /> Done
          </button>
        )}
      </div>
    </div>
  );
}

// ── Activity Panel ────────────────────────────────────────────────────────
function ActivityPanel({
  events, vehicles, stops, onClose,
}: {
  events: DispatchEvent[];
  vehicles: Vehicle[];
  stops: Stop[];
  onClose: () => void;
}) {
  const vehicleName = (id: string | null) =>
    id ? (vehicles.find(v => v.id === id)?.name ?? 'Vehicle') : null;
  const stopName = (id: string | null) =>
    id ? (stops.find(s => s.id === id)?.name ?? 'Stop') : null;

  const eventLabel = (e: DispatchEvent): { icon: React.ReactNode; text: string; sub: string } => {
    const vName = vehicleName(e.vehicleId);
    const sName = stopName(e.stopId);

    if (e.eventType === 'route_dispatched') return {
      icon: <Navigation2 className="w-3.5 h-3.5 text-blue-500" />,
      text: 'Route dispatched',
      sub: vName ?? '',
    };
    if (e.eventType === 'stop_completed') return {
      icon: <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />,
      text: `${sName ?? 'Stop'} completed`,
      sub: vName ?? '',
    };
    return {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />,
      text: 'Route completed',
      sub: vName ?? '',
    };
  };

  const fmtRelative = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <aside className="w-72 shrink-0 flex flex-col bg-white border-l border-slate-200 z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">Activity</h2>
        </div>
        <button onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-6 gap-2">
            <Bell className="w-8 h-8 text-slate-200" />
            <p className="text-xs text-slate-400">No activity yet. Dispatch a route to see events here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {events.map(e => {
              const { icon, text, sub } = eventLabel(e);
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition">
                  <div className="mt-0.5 shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{text}</div>
                    {sub && <div className="text-[10px] text-slate-400 truncate">{sub}</div>}
                  </div>
                  <div className="text-[10px] text-slate-400 shrink-0 tabular-nums">{fmtRelative(e.createdAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 text-center">
        {events.length} event{events.length !== 1 ? 's' : ''} · today's dispatch
      </div>
    </aside>
  );
}
