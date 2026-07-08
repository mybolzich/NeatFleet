import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck, MapPin, BarChart2, Download, Calendar,
  Play, CheckCircle2, Send, RotateCcw, Plus,
  ChevronDown, ChevronRight, GripVertical, Trash2,
  AlertTriangle, Clock, Package, User, LogOut,
  Layers, Settings, RefreshCw, Navigation, Route
} from 'lucide-react';
import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig } from './types';
import { optimizeRoutes } from './utils/optimizer';
import { InteractiveMap } from './components/InteractiveMap';
import { OrderBook } from './components/OrderBook';
import { FleetManager } from './components/FleetManager';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { AuthScreen } from './components/AuthScreen';
import { useAuthFirebase } from './lib/useAuthFirebase';
import { useCloudSync } from './lib/useCloudSync';

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
  const auth = useAuthFirebase();

  const [stops, setStops]           = useState<Stop[]>([]);
  const [vehicles, setVehicles]     = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [depot]                     = useState<Depot>(CENTRAL_DEPOT);
  const [trafficZones]              = useState<TrafficZone[]>(INITIAL_TRAFFIC);
  const [config, setConfig]         = useState<OptimizerConfig>({ minimizeVehicles: false, timeWindowWeight: 4, capacityWeight: 5, trafficAware: true });

  const [tab, setTab]               = useState<AppTab>('orders');
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('unbuilt');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [expandedCrews, setExpandedCrews] = useState<Set<string>>(new Set(['v1']));
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [building, setBuilding]     = useState(false);

  // Cloud sync (localStorage MVP)
  const companyId = auth.company?.$id ?? null;
  useCloudSync(companyId, stops, setStops, vehicles, setVehicles, depot, () => {}, trafficZones, () => {});

  // ── Stop CRUD ────────────────────────────────────────────────────────────
  const handleAddStop = useCallback((newStop: Omit<Stop,'id'|'status'|'assignedVehicleId'|'stopSequence'|'eta'|'arrivalTime'>) => {
    const stop: Stop = {
      ...newStop,
      id: `s_${Date.now()}`,
      status: 'Pending',
      assignedVehicleId: null,
      stopSequence: null,
      eta: null,
      arrivalTime: null,
    };
    setStops(prev => [...prev, stop]);
    setRouteStatus('unbuilt');
  }, []);

  const handleDeleteStop = useCallback((id: string) => {
    setStops(prev => prev.filter(s => s.id !== id));
    if (selectedStopId === id) setSelectedStopId(null);
    setRouteStatus('unbuilt');
  }, [selectedStopId]);

  const handleClearAllStops = useCallback(() => {
    setStops([]);
    setRouteStatus('unbuilt');
  }, []);

  const handleMapClickAdd = useCallback((x: number, y: number) => {
    // Map click creates a placeholder stop (user fills details in Orders panel)
    const stop: Stop = {
      id: `s_${Date.now()}`,
      name: `Stop ${stops.length + 1}`,
      customer: 'New Customer',
      x, y,
      address: 'Address pending',
      volume: 10,
      timeWindowStart: 0,
      timeWindowEnd: 480,
      serviceDuration: 20,
      priority: 'Medium',
      status: 'Pending',
      assignedVehicleId: null,
      stopSequence: null,
      eta: null,
      arrivalTime: null,
    };
    setStops(prev => [...prev, stop]);
    setSelectedStopId(stop.id);
    setTab('orders');
    setRouteStatus('unbuilt');
  }, [stops.length]);

  const handleUpdateStopCoords = useCallback((id: string, x: number, y: number) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
    setRouteStatus('unbuilt');
  }, []);

  // ── Vehicle CRUD ─────────────────────────────────────────────────────────
  const handleAddVehicle = (v: Omit<Vehicle,'id'|'status'|'metrics'>) => {
    setVehicles(prev => [...prev, {
      ...v, id: `v_${Date.now()}`, status: 'Idle',
      metrics: { totalDistance:0, totalTime:0, loadUsed:0, delayCount:0, totalCost:0 },
    }]);
  };
  const handleUpdateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };
  const handleDeleteVehicle = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  // ── Build Routes ─────────────────────────────────────────────────────────
  const handleBuildRoutes = useCallback(async () => {
    if (stops.length === 0) return;
    setBuilding(true);
    await new Promise(r => setTimeout(r, 600)); // brief visual feedback
    const { optimizedStops, optimizedVehicles } = optimizeRoutes(stops, vehicles, depot, trafficZones, config);
    setStops(optimizedStops);
    setVehicles(optimizedVehicles);
    setRouteStatus('built');
    setTab('routes');
    setBuilding(false);
    // Auto-expand all crews with stops
    const withStops = new Set(optimizedStops.filter(s => s.assignedVehicleId).map(s => s.assignedVehicleId!));
    setExpandedCrews(withStops);
  }, [stops, vehicles, depot, trafficZones, config]);

  // ── Dispatch ─────────────────────────────────────────────────────────────
  const handleDispatch = useCallback(() => {
    if (routeStatus !== 'built') return;
    setRouteStatus('dispatched');
    setVehicles(prev => prev.map(v =>
      v.metrics.loadUsed > 0 ? { ...v, status: 'Active' } : v
    ));
    setStops(prev => prev.map(s =>
      s.assignedVehicleId ? { ...s, status: 'In Transit' } : s
    ));
  }, [routeStatus]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStops(prev => prev.map(s => ({
      ...s, assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null, status: 'Pending'
    })));
    setVehicles(prev => prev.map(v => ({
      ...v, status: 'Idle',
      metrics: { totalDistance:0, totalTime:0, loadUsed:0, delayCount:0, totalCost:0 }
    })));
    setRouteStatus('unbuilt');
  }, []);

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

  const handleDropOnVehicle = (toVehicleId: string) => {
    if (!dragStopRef.current) return;
    const { stopId } = dragStopRef.current;
    setStops(prev => prev.map(s => s.id === stopId ? { ...s, assignedVehicleId: toVehicleId } : s));
    dragStopRef.current = null;
    if (routeStatus === 'dispatched') setRouteStatus('built');
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const assignedCount = stops.filter(s => s.assignedVehicleId).length;
  const unassignedCount = stops.length - assignedCount;
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
          <Kpi icon={<MapPin className="w-3.5 h-3.5 text-blue-500" />}
            label="Stops" value={`${assignedCount} / ${stops.length}`} sub="assigned" />
          <Kpi icon={<Truck className="w-3.5 h-3.5 text-emerald-500" />}
            label="Crew" value={`${activeCrews} / ${vehicles.length}`} sub="active" />
          <Kpi icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            label="Unassigned" value={String(unassignedCount)} sub="stops"
            alert={unassignedCount > 0} />
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
            <>
              <button onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Rebuild
              </button>
              <button onClick={handleDispatch}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm cursor-pointer">
                <Send className="w-3.5 h-3.5" /> Dispatch All
              </button>
            </>
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
                onLoadPreset={() => {}}
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
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Kpi({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${alert ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
      {icon}
      <div>
        <div className={`text-xs font-bold ${alert ? 'text-amber-700' : 'text-slate-800'}`}>{value}</div>
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
}

function RoutesPanel({
  stops, vehicles, routeStatus, expandedCrews, onToggleCrew,
  selectedStopId, onSelectStop, onSelectVehicle,
  onDeleteStop, onDragStart, onDropOnVehicle, onBuildRoutes, building
}: RoutesPanelProps) {

  const unassigned = stops.filter(s => !s.assignedVehicleId);
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">Route Plan</h2>
        {routeStatus === 'unbuilt' ? (
          <button onClick={onBuildRoutes} disabled={stops.length === 0 || building}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition cursor-pointer">
            {building ? 'Building...' : <><Play className="w-3 h-3" /> Build</>}
          </button>
        ) : (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${routeStatus === 'dispatched' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {routeStatus === 'dispatched' ? '✓ Dispatched' : 'Built'}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Unassigned stops */}
        {unassigned.length > 0 && (
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

        {/* Per-crew route sections */}
        {vehicles.map(v => {
          const crewStops = stops
            .filter(s => s.assignedVehicleId === v.id)
            .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));
          const expanded = expandedCrews.has(v.id);
          const totalMins = v.metrics.totalTime;
          const isDragTarget = dragOver === v.id;

          return (
            <div key={v.id}
              className={`border-b border-slate-100 transition ${isDragTarget ? 'bg-blue-50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(v.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => { setDragOver(null); onDropOnVehicle(v.id); }}>

              {/* Crew header */}
              <button
                onClick={() => { onToggleCrew(v.id); onSelectVehicle(v.id); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer text-left">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                <span className="flex-1 text-xs font-bold text-slate-800 truncate">{v.name}</span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="font-mono">{crewStops.length} stops</span>
                  {totalMins > 0 && <span className="font-mono">{Math.round(totalMins / 60 * 10) / 10}h</span>}
                </div>
                {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {/* Stop list */}
              {expanded && (
                <div className="pb-1">
                  {crewStops.length === 0 ? (
                    <p className="text-[10px] text-slate-400 px-10 py-2 italic">
                      {routeStatus === 'unbuilt' ? 'Drag stops here or build routes' : 'No stops assigned'}
                    </p>
                  ) : crewStops.map((stop, idx) => (
                    <StopRow key={stop.id} stop={stop} vehicle={v} index={idx}
                      selected={selectedStopId === stop.id}
                      onSelect={() => onSelectStop(stop.id)}
                      onDelete={() => onDeleteStop(stop.id)}
                      onDragStart={() => onDragStart(stop.id, v.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stop Row (used in routes panel) ──────────────────────────────────────
function StopRow({ stop, vehicle, index, selected, onSelect, onDelete, onDragStart }: {
  stop: Stop; vehicle: Vehicle | null; index?: number;
  selected: boolean; onSelect: () => void; onDelete: () => void; onDragStart: () => void;
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
