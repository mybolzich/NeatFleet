import { useState, useRef, useCallback } from 'react';
import {
  Truck, MapPin, BarChart2, Download, Calendar,
  Play, CheckCircle2, Send, RotateCcw, Plus,
  ChevronDown, ChevronRight, GripVertical, Trash2,
  AlertTriangle, LogOut, Layers, Settings, Route,
} from 'lucide-react';
import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig } from './types';
import { optimizeRoutes } from './utils/optimizer';
import { InteractiveMap } from './components/InteractiveMap';
import { OrderBook } from './components/OrderBook';
import { FleetManager } from './components/FleetManager';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { AuthScreen } from './components/AuthScreen';
import { useAuth } from './lib/useAuth';
import { useCloudSync } from './lib/useCloudSync';

// ── Constants ─────────────────────────────────────────────────────────────
const CENTRAL_DEPOT: Depot = {
  x: 50, y: 50,
  lat: 28.1518, lng: -82.3743,
  address: 'Tampa, FL (Cornerstone Dispatch)'
};

const CREW_COLORS = ['#38bdf8','#fb7185','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16'];

const INITIAL_VEHICLES: Vehicle[] = [
  { id: 'v1', name: 'Crew LM1 — Neri',   capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[0], speed: 1.6, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v2', name: 'Crew LM2 — Mateos', capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[1], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v3', name: 'Crew LM3 — Erick',  capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[2], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v4', name: 'Crew LM4 — Luis',   capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[3], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
  { id: 'v5', name: 'Crew LM5 — Mario',  capacity: 120, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 15, color: CREW_COLORS[4], speed: 1.5, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } },
];

type AppTab = 'orders' | 'routes' | 'fleet' | 'settings';
type RouteStatus = 'unbuilt' | 'built' | 'dispatched';

const fmtTime = (mins: number) => {
  const h = Math.floor(mins / 60) + 8;
  const m = mins % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${String(h > 12 ? h - 12 : h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
};

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();

  const [stops, setStops]         = useState<Stop[]>([]);
  const [vehicles, setVehicles]   = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [depot]                   = useState<Depot>(CENTRAL_DEPOT);
  const [trafficZones]            = useState<TrafficZone[]>([]);
  const [config, setConfig]       = useState<OptimizerConfig>({ minimizeVehicles: false, timeWindowWeight: 4, capacityWeight: 5, trafficAware: true });

  const [tab, setTab]             = useState<AppTab>('orders');
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('unbuilt');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [expandedCrews, setExpandedCrews] = useState<Set<string>>(new Set(['v1']));
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [building, setBuilding]   = useState(false);

  const companyId = auth.company?.id ?? null;
  useCloudSync(companyId, stops, setStops, vehicles, setVehicles, depot, () => {}, trafficZones, () => {});

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleAddStop = useCallback((newStop: Omit<Stop,'id'|'status'|'assignedVehicleId'|'stopSequence'|'eta'|'arrivalTime'>) => {
    setStops(prev => [...prev, { ...newStop, id: `s_${Date.now()}`, status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null }]);
    setRouteStatus('unbuilt');
  }, []);

  const handleDeleteStop = useCallback((id: string) => {
    setStops(prev => prev.filter(s => s.id !== id));
    if (selectedStopId === id) setSelectedStopId(null);
    setRouteStatus('unbuilt');
  }, [selectedStopId]);

  const handleClearAllStops = useCallback(() => { setStops([]); setRouteStatus('unbuilt'); }, []);

  const handleMapClickAdd = useCallback((x: number, y: number) => {
    const stop: Stop = { id: `s_${Date.now()}`, name: `Stop ${stops.length + 1}`, customer: 'New Customer', x, y, address: 'Address pending', volume: 10, timeWindowStart: 0, timeWindowEnd: 480, serviceDuration: 20, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null };
    setStops(prev => [...prev, stop]);
    setSelectedStopId(stop.id);
    setTab('orders');
    setRouteStatus('unbuilt');
  }, [stops.length]);

  const handleUpdateStopCoords = useCallback((id: string, x: number, y: number) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
    setRouteStatus('unbuilt');
  }, []);

  const handleAddVehicle = (v: Omit<Vehicle,'id'|'status'|'metrics'>) => {
    setVehicles(prev => [...prev, { ...v, id: `v_${Date.now()}`, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } }]);
  };
  const handleUpdateVehicle = (id: string, updates: Partial<Vehicle>) => setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  const handleDeleteVehicle = (id: string) => setVehicles(prev => prev.filter(v => v.id !== id));

  // ── Build / Dispatch / Reset ──────────────────────────────────────────────
  const handleBuildRoutes = useCallback(async () => {
    if (stops.length === 0) return;
    setBuilding(true);
    await new Promise(r => setTimeout(r, 500));
    const { optimizedStops, optimizedVehicles } = optimizeRoutes(stops, vehicles, depot, trafficZones, config);
    setStops(optimizedStops);
    setVehicles(optimizedVehicles);
    setRouteStatus('built');
    setTab('routes');
    setBuilding(false);
    setExpandedCrews(new Set(optimizedStops.filter(s => s.assignedVehicleId).map(s => s.assignedVehicleId!)));
  }, [stops, vehicles, depot, trafficZones, config]);

  const handleDispatch = useCallback(() => {
    if (routeStatus !== 'built') return;
    setRouteStatus('dispatched');
    setVehicles(prev => prev.map(v => v.metrics.loadUsed > 0 ? { ...v, status: 'Active' } : v));
    setStops(prev => prev.map(s => s.assignedVehicleId ? { ...s, status: 'In Transit' } : s));
  }, [routeStatus]);

  const handleReset = useCallback(() => {
    setStops(prev => prev.map(s => ({ ...s, assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null, status: 'Pending' })));
    setVehicles(prev => prev.map(v => ({ ...v, status: 'Idle', metrics: { totalDistance:0,totalTime:0,loadUsed:0,delayCount:0,totalCost:0 } })));
    setRouteStatus('unbuilt');
  }, []);

  const handleExportCSV = useCallback(() => {
    const header = 'Crew,Stop #,Customer,Address,Arrival,Window Open,Window Close,Service (min),Status\n';
    const rows = vehicles.flatMap(v => {
      const assigned = stops.filter(s => s.assignedVehicleId === v.id).sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));
      return assigned.map((s, i) => `"${v.name}",${i+1},"${s.customer}","${s.address}",${s.eta !== null ? fmtTime(s.eta) : 'TBD'},${fmtTime(s.timeWindowStart)},${fmtTime(s.timeWindowEnd)},${s.serviceDuration},${s.status}`);
    });
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `route_${serviceDate}.csv`; a.click();
  }, [stops, vehicles, serviceDate]);

  const dragStopRef = useRef<{ stopId: string; fromVehicleId: string | null } | null>(null);
  const handleDragStart = (stopId: string, fromVehicleId: string | null) => { dragStopRef.current = { stopId, fromVehicleId }; };
  const handleDropOnVehicle = (toVehicleId: string) => {
    if (!dragStopRef.current) return;
    setStops(prev => prev.map(s => s.id === dragStopRef.current!.stopId ? { ...s, assignedVehicleId: toVehicleId } : s));
    dragStopRef.current = null;
    if (routeStatus === 'dispatched') setRouteStatus('built');
  };

  const assignedCount   = stops.filter(s => s.assignedVehicleId).length;
  const unassignedCount = stops.length - assignedCount;
  const activeCrews     = vehicles.filter(v => stops.some(s => s.assignedVehicleId === v.id)).length;

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (auth.loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green-dark)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Loading NeatFleet…</p>
        </div>
      </div>
    );
  }

  if (!auth.authUser || !auth.profile || !auth.company) {
    return <AuthScreen auth={auth} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        zIndex: 20, gap: 16, flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)' }}>
            <Route size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>NeatFleet</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>{auth.company.name.toUpperCase()}</div>
          </div>
        </div>

        {/* Date picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>
          <Calendar size={13} color="var(--text-3)" />
          <input type="date" value={serviceDate}
            onChange={e => { setServiceDate(e.target.value); handleReset(); }}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }} />
        </div>

        {/* KPI strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
          <KpiChip icon={<MapPin size={12} color="var(--green-dark)" />} value={`${assignedCount}/${stops.length}`} label="stops" />
          <KpiChip icon={<Truck size={12} color="var(--blue)" />} value={`${activeCrews}/${vehicles.length}`} label="crews" />
          {unassignedCount > 0 && (
            <KpiChip icon={<AlertTriangle size={12} color="var(--amber)" />} value={String(unassignedCount)} label="unassigned" alert />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {routeStatus === 'unbuilt' && (
            <button onClick={handleBuildRoutes} disabled={stops.length === 0 || building} className="btn btn-green btn-sm">
              {building
                ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Building…</>
                : <><Play size={12} /> Build Routes</>}
            </button>
          )}
          {routeStatus === 'built' && (<>
            <button onClick={handleReset} className="btn btn-ghost btn-sm"><RotateCcw size={12} /> Rebuild</button>
            <button onClick={handleDispatch} className="btn btn-green btn-sm"><Send size={12} /> Dispatch All</button>
          </>)}
          {routeStatus === 'dispatched' && (<>
            <span className="pill pill-green" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={11} /> Dispatched
            </span>
            <button onClick={handleReset} className="btn btn-ghost btn-sm"><RotateCcw size={12} /> Reset</button>
          </>)}

          <button onClick={handleExportCSV} disabled={stops.length === 0} className="btn btn-ghost btn-sm">
            <Download size={12} /> CSV
          </button>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)' }}>{auth.profile.full_name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, textTransform: 'capitalize' }}>{auth.profile.role}</div>
          </div>
          <button onClick={auth.logout} title="Sign out"
            style={{ padding: 8, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-3)', transition: 'color .15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── WORKSPACE ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
        <aside style={{
          width: 340, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          zIndex: 10,
        }}>
          {/* Tab nav */}
          <div className="tab-nav">
            {([
              ['orders',   MapPin,    'Orders'],
              ['routes',   Layers,    'Routes'],
              ['fleet',    Truck,     'Crew'],
              ['settings', Settings,  'Solver'],
            ] as const).map(([id, Icon, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`tab-btn ${tab === id ? 'active' : ''}`}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {tab === 'orders' && (
              <OrderBook stops={stops} onAddStop={handleAddStop} onDeleteStop={handleDeleteStop}
                onLoadPreset={() => {}} selectedStopId={selectedStopId} onSelectStop={setSelectedStopId}
                onClearAllStops={handleClearAllStops}
                dispatchLat={auth.company?.dispatch_lat ?? depot.lat}
                dispatchLng={auth.company?.dispatch_lng ?? depot.lng} />
            )}
            {tab === 'routes' && (
              <RoutesPanel stops={stops} vehicles={vehicles} routeStatus={routeStatus}
                expandedCrews={expandedCrews}
                onToggleCrew={id => setExpandedCrews(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                selectedStopId={selectedStopId} onSelectStop={setSelectedStopId}
                onSelectVehicle={setSelectedVehicleId} onDeleteStop={handleDeleteStop}
                onDragStart={handleDragStart} onDropOnVehicle={handleDropOnVehicle}
                onBuildRoutes={handleBuildRoutes} building={building} />
            )}
            {tab === 'fleet' && (
              <FleetManager vehicles={vehicles} onAddVehicle={handleAddVehicle}
                onUpdateVehicle={handleUpdateVehicle} onDeleteVehicle={handleDeleteVehicle}
                selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
            )}
            {tab === 'settings' && (
              <AnalyticsPanel vehicles={vehicles} stops={stops} config={config}
                onUpdateConfig={setConfig} onOptimize={handleBuildRoutes} />
            )}
          </div>
        </aside>

        {/* ── MAP ───────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Status badge over map */}
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={routeStatus} />
            {routeStatus === 'unbuilt' && stops.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', background: 'rgba(255,255,255,.92)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', backdropFilter: 'blur(4px)' }}>
                {stops.length} stop{stops.length !== 1 ? 's' : ''} ready
              </span>
            )}
          </div>

          <InteractiveMap
            stops={stops} vehicles={vehicles} depot={depot} trafficZones={trafficZones}
            simulationTime={0} isSimulationRunning={false}
            onAddStop={handleMapClickAdd} onUpdateStopCoordinates={handleUpdateStopCoords}
            selectedStopId={selectedStopId} onSelectStop={setSelectedStopId}
            selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId}
          />
        </main>
      </div>
    </div>
  );
}

// ── KPI chip ──────────────────────────────────────────────────────────────
function KpiChip({ icon, value, label, alert }: { icon: React.ReactNode; value: string; label: string; alert?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 12px',
      borderRadius: 'var(--radius-sm)',
      background: alert ? '#FEF3C7' : 'var(--bg)',
      border: `1px solid ${alert ? '#FDE68A' : 'var(--border)'}`,
    }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 800, color: alert ? 'var(--amber)' : 'var(--text-1)' }}>{value}</span>
      <span className="label-sm" style={{ color: alert ? '#92400E' : undefined }}>{label}</span>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: RouteStatus }) {
  const configs = {
    unbuilt:    { dot: 'dot dot-grey',  label: 'Planning',   bg: 'rgba(255,255,255,.92)', border: 'var(--border)',      text: 'var(--text-2)' },
    built:      { dot: 'dot dot-blue',  label: 'Built — Ready to Dispatch', bg: 'rgba(255,255,255,.92)', border: '#BFDBFE', text: 'var(--blue)' },
    dispatched: { dot: 'dot dot-green pulse-dot', label: 'Dispatched', bg: 'rgba(255,255,255,.92)', border: '#BBF7D0', text: 'var(--green-dark)' },
  }[status];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, background: configs.bg, border: `1px solid ${configs.border}`, color: configs.text, padding: '6px 12px', borderRadius: 10, boxShadow: 'var(--shadow)', backdropFilter: 'blur(4px)' }}>
      <span className={configs.dot} />
      {configs.label}
    </span>
  );
}

// ── Routes Panel ──────────────────────────────────────────────────────────
interface RoutesPanelProps {
  stops: Stop[]; vehicles: Vehicle[]; routeStatus: RouteStatus;
  expandedCrews: Set<string>; onToggleCrew: (id: string) => void;
  selectedStopId: string | null; onSelectStop: (id: string | null) => void;
  onSelectVehicle: (id: string | null) => void; onDeleteStop: (id: string) => void;
  onDragStart: (stopId: string, vehicleId: string | null) => void;
  onDropOnVehicle: (vehicleId: string) => void;
  onBuildRoutes: () => void; building: boolean;
}

function RoutesPanel({ stops, vehicles, routeStatus, expandedCrews, onToggleCrew, selectedStopId, onSelectStop, onSelectVehicle, onDeleteStop, onDragStart, onDropOnVehicle, onBuildRoutes, building }: RoutesPanelProps) {
  const unassigned = stops.filter(s => !s.assignedVehicleId);
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <span className="panel-title">Route Plan</span>
        {routeStatus === 'unbuilt' ? (
          <button onClick={onBuildRoutes} disabled={stops.length === 0 || building} className="btn btn-green btn-sm">
            {building ? 'Building…' : <><Play size={11} /> Build</>}
          </button>
        ) : (
          <span className={`pill ${routeStatus === 'dispatched' ? 'pill-green' : 'pill-blue'}`}>
            {routeStatus === 'dispatched' ? '✓ Dispatched' : 'Built'}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {/* Unassigned */}
        {unassigned.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--border)', background: '#FFFBEB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
              <AlertTriangle size={13} color="var(--amber)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>Unassigned ({unassigned.length})</span>
            </div>
            {unassigned.map(stop => (
              <StopRow key={stop.id} stop={stop} vehicle={null}
                selected={selectedStopId === stop.id}
                onSelect={() => onSelectStop(stop.id)}
                onDelete={() => onDeleteStop(stop.id)}
                onDragStart={() => onDragStart(stop.id, null)} />
            ))}
          </div>
        )}

        {/* Per-crew sections */}
        {vehicles.map(v => {
          const crewStops = stops.filter(s => s.assignedVehicleId === v.id).sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));
          const expanded = expandedCrews.has(v.id);
          return (
            <div key={v.id}
              style={{ borderBottom: '1px solid var(--border)', background: dragOver === v.id ? 'var(--blue-light)' : 'transparent', transition: 'background .15s' }}
              onDragOver={e => { e.preventDefault(); setDragOver(v.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => { setDragOver(null); onDropOnVehicle(v.id); }}>

              <button onClick={() => { onToggleCrew(v.id); onSelectVehicle(v.id); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span className="crew-dot" style={{ backgroundColor: v.color }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{crewStops.length} stops</span>
                {v.metrics.totalTime > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{Math.round(v.metrics.totalTime / 60 * 10) / 10}h</span>}
                {expanded ? <ChevronDown size={13} color="var(--text-3)" /> : <ChevronRight size={13} color="var(--text-3)" />}
              </button>

              {expanded && (
                <div style={{ paddingBottom: 4 }}>
                  {crewStops.length === 0
                    ? <p style={{ fontSize: 11, color: 'var(--text-3)', padding: '4px 16px 8px 42px', fontStyle: 'italic' }}>
                        {routeStatus === 'unbuilt' ? 'Drag stops here or build routes' : 'No stops assigned'}
                      </p>
                    : crewStops.map((stop, idx) => (
                        <StopRow key={stop.id} stop={stop} vehicle={v} index={idx}
                          selected={selectedStopId === stop.id}
                          onSelect={() => onSelectStop(stop.id)}
                          onDelete={() => onDeleteStop(stop.id)}
                          onDragStart={() => onDragStart(stop.id, v.id)} />
                      ))
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stop Row ──────────────────────────────────────────────────────────────
function StopRow({ stop, vehicle, index, selected, onSelect, onDelete, onDragStart }: {
  stop: Stop; vehicle: Vehicle | null; index?: number;
  selected: boolean; onSelect: () => void; onDelete: () => void; onDragStart: () => void;
}) {
  const fmtTime = (m: number) => { const h = Math.floor(m/60)+8, mn=m%60, ap=h<12?'AM':'PM'; return `${String(h>12?h-12:h).padStart(2,'0')}:${String(mn).padStart(2,'0')} ${ap}`; };
  const isDelayed = stop.arrivalTime !== null && stop.arrivalTime > stop.timeWindowEnd;

  return (
    <div draggable onDragStart={e => { e.stopPropagation(); onDragStart(); }} onClick={onSelect}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', background: selected ? 'var(--blue-light)' : 'transparent', transition: 'background .1s', borderLeft: selected ? '2px solid var(--blue)' : '2px solid transparent' }}>
      <GripVertical size={13} color="var(--border)" style={{ flexShrink: 0, cursor: 'grab' }} />
      {index !== undefined && (
        <span style={{ width: 18, height: 18, borderRadius: '50%', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', backgroundColor: vehicle?.color ?? '#94a3b8' }}>
          {index + 1}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.address}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {stop.eta !== null && (
          <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isDelayed ? 'var(--red)' : 'var(--text-3)' }}>
            {fmtTime(stop.eta)}
          </span>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ padding: 4, background: 'none', border: 'none', color: 'var(--border)', cursor: 'pointer', borderRadius: 4, transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
