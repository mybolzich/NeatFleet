import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Navigation, Compass, ShieldAlert, CircleAlert, CloudRain, ShieldCheck, Truck } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Stop, Vehicle, Depot, TrafficZone } from '../types';
import { getDistance } from '../utils/optimizer';
import { getRoutingProvider } from '../lib/providers/routing';
import type { LatLng } from '../lib/providers/types';

// User-supplied text (stop/customer/vehicle names) gets interpolated into
// Leaflet divIcon HTML strings below, which — unlike JSX — are injected as
// raw innerHTML with no auto-escaping. Escape it ourselves to avoid stored
// XSS via a stop name like `<img src=x onerror=...>`.
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function depotDivIcon() {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div class="bg-emerald-600 border-2 border-white rounded-full shadow-lg" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:14px;">★</span>
        </div>
        <div class="bg-emerald-700 text-white shadow-xs" style="font-size:10px;padding:1px 6px;border-radius:4px;margin-top:2px;white-space:nowrap;font-weight:900;text-transform:uppercase;">DEPOT</div>
      </div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [16, 20],
  });
}

function stopDivIcon(pinColor: string, borderColor: string, label: string, name: string) {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div class="shadow-md transition-transform" style="width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:white;border:2px solid ${borderColor};background:${pinColor};">${escapeHtml(label)}</div>
        <div class="bg-slate-900/90 shadow-xs" style="color:white;font-size:10px;padding:1px 6px;border-radius:4px;margin-top:2px;white-space:nowrap;font-weight:600;">${escapeHtml(name)}</div>
      </div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [14, 14],
  });
}

function vehicleDivIcon(color: string, label: string) {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div class="bg-slate-900 shadow-lg" style="width:28px;height:28px;border-radius:9999px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:12px;">🚚</span>
        </div>
        <div class="bg-slate-950/90 shadow-md" style="color:white;font-size:9px;padding:1px 6px;border-radius:4px;margin-top:2px;white-space:nowrap;font-weight:900;text-transform:uppercase;letter-spacing:0.02em;">${escapeHtml(label)}</div>
      </div>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [14, 14],
  });
}

function ClickToAddStop({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Road-following route for a vehicle's stop sequence, via the configured
// RoutingProvider (OpenRouteService or OSRM — see src/lib/providers/routing).
// Falls back to a straight-line path if the provider fails (no API key
// configured, no real geocoded coordinates yet, network error) so a route
// is always visible.
function RoadRoute({
  depot,
  waypoints,
  color,
  isSelected,
}: {
  depot: LatLng;
  waypoints: LatLng[];
  color: string;
  isSelected: boolean;
  key?: React.Key;
}) {
  const [path, setPath] = useState<LatLng[] | null>(null);

  const routeKey = useMemo(
    () => waypoints.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|'),
    [waypoints]
  );

  useEffect(() => {
    if (waypoints.length === 0) {
      setPath(null);
      return;
    }

    let cancelled = false;
    const fullRoute = [depot, ...waypoints, depot];

    getRoutingProvider()
      .route(fullRoute)
      .then((result) => {
        if (cancelled) return;
        setPath(result ? result.path : fullRoute);
      })
      .catch(() => {
        if (!cancelled) setPath(fullRoute);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depot.lat, depot.lng, routeKey]);

  if (!path || path.length < 2) return null;

  return (
    <Polyline
      positions={path.map((p) => [p.lat, p.lng]) as [number, number][]}
      pathOptions={{ color, weight: isSelected ? 4 : 2, opacity: isSelected ? 0.9 : 0.5 }}
    />
  );
}

interface InteractiveMapProps {
  stops: Stop[];
  vehicles: Vehicle[];
  depot: Depot;
  trafficZones: TrafficZone[];
  simulationTime: number; // minutes from 8:00 AM
  isSimulationRunning: boolean;
  onAddStop: (x: number, y: number) => void;
  onUpdateStopCoordinates: (id: string, x: number, y: number) => void;
  selectedStopId: string | null;
  onSelectStop: (id: string | null) => void;
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  stops,
  vehicles,
  depot,
  trafficZones,
  simulationTime,
  isSimulationRunning,
  onAddStop,
  onUpdateStopCoordinates,
  selectedStopId,
  onSelectStop,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null);
  const [hoveredStop, setHoveredStop] = useState<Stop | null>(null);
  const [hoveredVehicle, setHoveredVehicle] = useState<Vehicle | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [animatedVehicles, setAnimatedVehicles] = useState<
    Record<string, { x: number; y: number; statusText: string; currentStopName: string }>
  >({});

  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');

  // Use Tampa Bay as the default center (Cornerstone Landscape HQ area)
  const GRID_BASE_LAT = depot.lat ?? 28.1518;
  const GRID_BASE_LNG = depot.lng ?? -82.3743;
  const LAT_SCALE = -0.002;
  const LNG_SCALE = 0.0025;

  const gridToLatLng = (x: number, y: number) => {
    return {
      lat: GRID_BASE_LAT + (y - 50) * LAT_SCALE,
      lng: GRID_BASE_LNG + (x - 50) * LNG_SCALE,
    };
  };

  // For stops: prefer real lat/lng from geocoding, fall back to grid conversion
  const stopToLatLng = (stop: Stop) => {
    if (stop.lat && stop.lng) return { lat: stop.lat, lng: stop.lng };
    return gridToLatLng(stop.x, stop.y);
  };

  const latLngToGrid = (lat: number, lng: number) => {
    return {
      x: Math.max(0, Math.min(100, parseFloat((50 + (lng - GRID_BASE_LNG) / LNG_SCALE).toFixed(1)))),
      y: Math.max(0, Math.min(100, parseFloat((50 + (lat - GRID_BASE_LAT) / LAT_SCALE).toFixed(1)))),
    };
  };

  // OSM-compatible raster tiles from a configured provider (e.g. MapTiler,
  // Stadia Maps, Thunderforest, or a self-hosted tile server) — never the
  // public tile.openstreetmap.org demo server, which explicitly disallows
  // unlimited production traffic.
  const TILE_URL = (import.meta.env.VITE_MAP_TILE_URL as string) || '';
  const TILE_ATTRIBUTION = (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string) || '© OpenStreetMap contributors';
  const hasValidTileConfig = Boolean(TILE_URL) && TILE_URL.trim() !== '';

  // Convert client cursor coords to SVG 0-100 coords
  const getSVGCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, parseFloat(x.toFixed(1)))),
      y: Math.max(0, Math.min(100, parseFloat(y.toFixed(1)))),
    };
  };

  // Drag stop handlers
  const handleMouseDown = (stopId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedStopId(stopId);
    onSelectStop(stopId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getSVGCoordinates(e.clientX, e.clientY);
    setCursorPos(coords);

    if (draggedStopId) {
      onUpdateStopCoordinates(draggedStopId, coords.x, coords.y);
    }
  };

  const handleMouseUp = () => {
    setDraggedStopId(null);
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (draggedStopId) return;
    const coords = getSVGCoordinates(e.clientX, e.clientY);
    onAddStop(coords.x, coords.y);
  };

  // Calculate animated vehicle positions in real-time along their route
  useEffect(() => {
    const positions: typeof animatedVehicles = {};

    vehicles.forEach((vehicle) => {
      const assignedStops = stops
        .filter((s) => s.assignedVehicleId === vehicle.id)
        .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));

      if (assignedStops.length === 0) {
        positions[vehicle.id] = {
          x: depot.x,
          y: depot.y,
          statusText: 'Idle',
          currentStopName: 'Depot',
        };
        return;
      }

      // We have stops. Build the schedule timeline
      // Each entry: { startX, startY, endX, endY, startTime, endTime, type: 'drive' | 'service', stop?: Stop }
      interface TimelineEntry {
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        startTime: number;
        endTime: number;
        type: 'drive' | 'service';
        label: string;
        stop?: Stop;
      }

      const timeline: TimelineEntry[] = [];
      let currentPosition = { x: depot.x, y: depot.y };
      let currentTime = vehicle.shiftStart;

      assignedStops.forEach((stop, idx) => {
        // 1. Drive Segment
        const arrTime = stop.arrivalTime ?? currentTime; // Fallback to current
        timeline.push({
          startX: currentPosition.x,
          startY: currentPosition.y,
          endX: stop.x,
          endY: stop.y,
          startTime: currentTime,
          endTime: arrTime,
          type: 'drive',
          label: `Driving to ${stop.name}`,
          stop,
        });

        // 2. Service Segment (including waiting time if arrived early)
        const serviceStart = Math.max(arrTime, stop.timeWindowStart);
        const serviceEnd = serviceStart + stop.serviceDuration;

        // If wait needed
        if (serviceStart > arrTime) {
          timeline.push({
            startX: stop.x,
            startY: stop.y,
            endX: stop.x,
            endY: stop.y,
            startTime: arrTime,
            endTime: serviceStart,
            type: 'service',
            label: `Waiting at ${stop.name}`,
            stop,
          });
        }

        timeline.push({
          startX: stop.x,
          startY: stop.y,
          endX: stop.x,
          endY: stop.y,
          startTime: serviceStart,
          endTime: serviceEnd,
          type: 'service',
          label: `Servicing ${stop.name}`,
          stop,
        });

        currentTime = serviceEnd;
        currentPosition = { x: stop.x, y: stop.y };
      });

      // 3. Return to depot Segment
      const totalTimeMinutes = vehicle.shiftStart + (vehicle.metrics?.totalTime ?? 60);
      timeline.push({
        startX: currentPosition.x,
        startY: currentPosition.y,
        endX: depot.x,
        endY: depot.y,
        startTime: currentTime,
        endTime: totalTimeMinutes,
        type: 'drive',
        label: 'Returning to Depot',
      });

      // Determine where the vehicle is at simulationTime
      let found = false;

      // Check if simulationTime is before vehicle start
      if (simulationTime < vehicle.shiftStart) {
        positions[vehicle.id] = {
          x: depot.x,
          y: depot.y,
          statusText: 'Off Shift',
          currentStopName: 'Depot',
        };
        found = true;
      }

      // Check timeline
      if (!found) {
        for (const entry of timeline) {
          if (simulationTime >= entry.startTime && simulationTime <= entry.endTime) {
            const duration = entry.endTime - entry.startTime;
            const progress = duration > 0 ? (simulationTime - entry.startTime) / duration : 1;

            const x = entry.startX + progress * (entry.endX - entry.startX);
            const y = entry.startY + progress * (entry.endY - entry.startY);

            positions[vehicle.id] = {
              x,
              y,
              statusText: entry.type === 'drive' ? 'In Transit' : 'Servicing',
              currentStopName: entry.stop ? entry.stop.name : 'Depot',
            };
            found = true;
            break;
          }
        }
      }

      // If simulationTime is after entire timeline
      if (!found) {
        positions[vehicle.id] = {
          x: depot.x,
          y: depot.y,
          statusText: 'Idle',
          currentStopName: 'Depot',
        };
      }
    });

    setAnimatedVehicles(positions);
  }, [stops, vehicles, depot, simulationTime]);

  const handleLeafletMapClick = (lat: number, lng: number) => {
    const gridCoords = latLngToGrid(lat, lng);
    onAddStop(gridCoords.x, gridCoords.y);
  };

  const handleMarkerDragEnd = (stopId: string, marker: L.Marker) => {
    const { lat, lng } = marker.getLatLng();
    const gridCoords = latLngToGrid(lat, lng);
    onUpdateStopCoordinates(stopId, gridCoords.x, gridCoords.y);
  };

  const renderTopBar = () => (
    <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center gap-3">
        <Compass className="w-5 h-5 text-blue-600 animate-spin-slow" />
        <div>
          <h3 className="text-sm font-bold text-slate-800">Live Dispatch Planner</h3>
          <p className="text-xs text-slate-500">
            {viewMode === 'map' ? 'OpenStreetMap-based street map active' : isSimulationRunning ? 'Simulation active' : 'Drag stops to re-route • Click canvas to add orders'}
          </p>
        </div>
      </div>

      {/* View Mode Segmented Tab */}
      <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-200/60 shadow-xs">
        <button
          onClick={() => setViewMode('grid')}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
            viewMode === 'grid'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Abstract Grid
        </button>
        <button
          onClick={() => setViewMode('map')}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
            viewMode === 'map'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Street Map</span>
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          Traffic Aware
        </div>
        {viewMode === 'grid' ? (
          <div className="text-slate-500 hidden sm:block">
            Grid Cursor: <span className="text-slate-800 font-mono font-semibold">{cursorPos ? `X:${Math.round(cursorPos.x)} Y:${Math.round(cursorPos.y)}` : '0, 0'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-xs text-slate-500 font-semibold">
            {TILE_ATTRIBUTION}
          </div>
        )}
      </div>
    </div>
  );

  const renderLegend = () => (
    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-4 items-center justify-between bg-white/95 backdrop-blur-md border border-slate-200 p-3.5 rounded-xl text-xs text-slate-600 select-none shadow-md z-10">
      <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
          Central Depot
        </div>
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <span className="w-2.5 h-2.5 rounded bg-slate-400"></span>
          Unassigned Stop
        </div>
        {vehicles.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelectVehicle(selectedVehicleId === v.id ? null : v.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer shadow-xs ${
              selectedVehicleId === v.id
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:text-slate-800'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: v.color }}></span>
            {v.name} ({stops.filter((s) => s.assignedVehicleId === v.id).length} stops)
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
        <span className="text-slate-500 font-mono font-semibold">Simulated Time:</span>
        <span className="text-blue-600 font-bold font-mono">
          {String(Math.floor(simulationTime / 60) + 8).padStart(2, '0')}:
          {String(simulationTime % 60).padStart(2, '0')}{' '}
          {Math.floor(simulationTime / 60) + 8 < 12 ? 'AM' : 'PM'}
        </span>
      </div>
    </div>
  );

  if (viewMode === 'map' && !hasValidTileConfig) {
    return (
      <div className="relative flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {renderTopBar()}

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 overflow-y-auto">
          <div className="max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-sm text-slate-700">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl border border-blue-200 flex items-center justify-center text-blue-600 mx-auto mb-4">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-2">OpenStreetMap Tile Provider Needed</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              This map renders OSM-compatible tiles from a provider you configure — never the public
              tile.openstreetmap.org demo server, which isn't licensed for unlimited production traffic.
            </p>

            <div className="text-left space-y-4 mb-6 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-800">To enable the street map:</p>
              <ol className="list-decimal list-inside space-y-2.5 text-slate-600 font-sans">
                <li>
                  Sign up for a tile provider — e.g.{' '}
                  <a href="https://www.maptiler.com/cloud/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
                    MapTiler
                  </a>{' '}
                  or{' '}
                  <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">
                    Stadia Maps
                  </a>{' '}
                  (both have free tiers), or self-host a tile server.
                </li>
                <li>
                  Copy the raster XYZ tile URL template (e.g. <code className="bg-slate-200 px-1 rounded">.../&#123;z&#125;/&#123;x&#125;/&#123;y&#125;.png?key=...</code>)
                </li>
                <li>
                  Set <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono font-bold text-[11px]">VITE_MAP_TILE_URL</code> in <code className="bg-slate-200 px-1 rounded">.env.local</code>
                </li>
                <li>
                  Optionally set <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono font-bold text-[11px]">VITE_MAP_TILE_ATTRIBUTION</code> to match your provider's required attribution text
                </li>
              </ol>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className="flex-1 py-2 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-xl transition cursor-pointer shadow-xs"
              >
                Back to Abstract Grid
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {renderTopBar()}

      {/* Interactive Map Visual Element */}
      <div className="relative flex-1 w-full bg-slate-50 select-none overflow-hidden">
        {viewMode === 'grid' ? (
          <>
            {/* Subtle grid pattern background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4%_4%] opacity-65 pointer-events-none" />

            <svg
              ref={svgRef}
              className="w-full h-full cursor-crosshair"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleMapClick}
            >
              {/* Traffic Congestion Zones */}
              {trafficZones.map((zone) => (
                <g key={zone.id} className="opacity-15 hover:opacity-25 transition-opacity">
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={zone.radius}
                    fill={
                      zone.severity === 'Heavy'
                        ? '#ef4444'
                        : zone.severity === 'Moderate'
                        ? '#f59e0b'
                        : '#3b82f6'
                    }
                  />
                  <text
                    x={zone.x}
                    y={zone.y + 1}
                    className="fill-slate-700 font-extrabold font-sans text-[2px]"
                    textAnchor="middle"
                  >
                    ⚠️ {zone.severity} Traffic
                  </text>
                </g>
              ))}

              {/* Depot Element */}
              <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelectStop(null); }}>
                {/* Visual glow ring */}
                <circle
                  cx={depot.x}
                  cy={depot.y}
                  r="4.5"
                  className="fill-emerald-100 stroke-emerald-400 stroke-[0.5] opacity-50 animate-pulse"
                />
                <rect
                  x={depot.x - 2.5}
                  y={depot.y - 2.5}
                  width="5"
                  height="5"
                  rx="1"
                  className="fill-emerald-600 stroke-white stroke-[0.5] shadow-xs"
                />
                <polygon
                  points={`${depot.x},${depot.y - 1.5} ${depot.x - 1.5},${depot.y + 1.2} ${depot.x + 1.5},${depot.y + 1.2}`}
                  className="fill-white"
                />
                <text
                  x={depot.x}
                  y={depot.y + 5.5}
                  className="fill-emerald-800 font-extrabold font-mono text-[2.2px]"
                  textAnchor="middle"
                >
                  DEPOT
                </text>
              </g>

              {/* Render Routing Paths for vehicles */}
              {vehicles.map((vehicle) => {
                const assignedStops = stops
                  .filter((s) => s.assignedVehicleId === vehicle.id)
                  .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));

                if (assignedStops.length === 0) return null;

                const isSelected = selectedVehicleId === vehicle.id;

                return (
                  <g key={`route-${vehicle.id}`} className="transition-all">
                    {/* Path lines */}
                    <path
                      d={`M ${depot.x} ${depot.y} ${assignedStops
                        .map((s) => `L ${s.x} ${s.y}`)
                        .join(' ')} L ${depot.x} ${depot.y}`}
                      fill="none"
                      stroke={vehicle.color}
                      strokeWidth={isSelected ? '0.9' : '0.45'}
                      strokeOpacity={isSelected ? '0.9' : '0.45'}
                      strokeDasharray={isSelected ? 'none' : '1,1'}
                      className="transition-all"
                    />

                    {/* Directional arrow flow markers */}
                    {assignedStops.map((stop, sIdx) => {
                      const prev = sIdx === 0 ? depot : assignedStops[sIdx - 1];
                      const midX = (prev.x + stop.x) / 2;
                      const midY = (prev.y + stop.y) / 2;
                      const angle = Math.atan2(stop.y - prev.y, stop.x - prev.x) * (180 / Math.PI);

                      return (
                        <polygon
                          key={`arrow-${vehicle.id}-${stop.id}`}
                          points="-0.8,-0.6 0.8,0 -0.8,0.6"
                          fill={vehicle.color}
                          opacity={isSelected ? '0.95' : '0.4'}
                          transform={`translate(${midX}, ${midY}) rotate(${angle}) scale(${isSelected ? '1' : '0.7'})`}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* Render Stop Markers */}
              {stops.map((stop) => {
                const isSelected = selectedStopId === stop.id;
                const assignedVehicle = stop.assignedVehicleId
                  ? vehicles.find((v) => v.id === stop.assignedVehicleId)
                  : null;
                const color = assignedVehicle ? assignedVehicle.color : '#94a3b8';
                const hasViolation = stop.eta !== null && stop.eta > stop.timeWindowEnd;

                return (
                  <g
                    key={stop.id}
                    className="cursor-grab active:cursor-grabbing group"
                    onMouseDown={(e) => handleMouseDown(stop.id, e)}
                    onMouseEnter={() => setHoveredStop(stop)}
                    onMouseLeave={() => setHoveredStop(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStop(selectedStopId === stop.id ? null : stop.id);
                    }}
                  >
                    {/* Selection Highlighting Ring */}
                    {isSelected && (
                      <circle
                        cx={stop.x}
                        cy={stop.y}
                        r="3.5"
                        className="fill-none stroke-blue-500 stroke-[0.6] animate-pulse"
                      />
                    )}

                    {/* Time Window SLA Violation indicator */}
                    {hasViolation && (
                      <circle
                        cx={stop.x}
                        cy={stop.y}
                        r="2.8"
                        className="fill-none stroke-red-500 stroke-[0.5] animate-ping"
                      />
                    )}

                    {/* Core Stop Circle */}
                    <circle
                      cx={stop.x}
                      cy={stop.y}
                      r="1.8"
                      className="transition-all duration-150 border-2"
                      fill={color}
                      stroke={isSelected ? '#ffffff' : '#334155'}
                      strokeWidth="0.4"
                    />

                    {/* Sequential Stop Index inside Pin */}
                    <text
                      x={stop.x}
                      y={stop.y + 0.65}
                      className="fill-white font-extrabold font-mono text-[1.8px] text-center"
                      textAnchor="middle"
                    >
                      {stop.stopSequence !== null ? stop.stopSequence + 1 : '•'}
                    </text>

                    {/* Hover text label */}
                    <text
                      x={stop.x}
                      y={stop.y - 2.8}
                      className="fill-slate-700 font-extrabold font-sans opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] text-[2.2px]"
                      textAnchor="middle"
                    >
                      {stop.name}
                    </text>
                  </g>
                );
              })}

              {/* Simulated vehicles moving in real-time */}
              {vehicles.map((vehicle) => {
                const pos = animatedVehicles[vehicle.id];
                if (!pos || vehicle.metrics.loadUsed === 0) return null;

                const isSelected = selectedVehicleId === vehicle.id;

                return (
                  <g
                    key={`anim-veh-${vehicle.id}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredVehicle(vehicle)}
                    onMouseLeave={() => setHoveredVehicle(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectVehicle(selectedVehicleId === vehicle.id ? null : vehicle.id);
                    }}
                  >
                    {/* Simulated pulse wave */}
                    {isSelected && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="4"
                        className="fill-none stroke-blue-400 stroke-[0.4] animate-ping"
                      />
                    )}

                    {/* Inner vehicle icon body */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="2"
                      fill={vehicle.color}
                      stroke="#ffffff"
                      strokeWidth="0.5"
                      className="shadow-md"
                    />

                    {/* Center point or chevron indicator */}
                    <polygon
                      points="0,-1.4 0.9,1 0,0.5 -0.9,1"
                      fill="#ffffff"
                      transform={`translate(${pos.x}, ${pos.y}) scale(0.8)`}
                    />

                    {/* Floating vehicle text */}
                    <text
                      x={pos.x}
                      y={pos.y - 3}
                      className="fill-slate-800 font-bold font-mono drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] text-[2px]"
                      textAnchor="middle"
                    >
                      {vehicle.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>

            {renderLegend()}
          </>
        ) : (
          <div className="w-full h-full relative">
            <MapContainer
              center={[gridToLatLng(depot.x, depot.y).lat, gridToLatLng(depot.x, depot.y).lng]}
              zoom={12}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
            >
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <ClickToAddStop onAdd={handleLeafletMapClick} />

              {/* Depot Marker */}
              <Marker
                position={[gridToLatLng(depot.x, depot.y).lat, gridToLatLng(depot.x, depot.y).lng]}
                icon={depotDivIcon()}
              />

              {/* Stop Markers */}
              {stops.map((stop) => {
                const latLng = stopToLatLng(stop);
                const isSelected = selectedStopId === stop.id;
                const assignedVehicle = stop.assignedVehicleId ? vehicles.find((v) => v.id === stop.assignedVehicleId) : null;
                const pinColor = assignedVehicle ? assignedVehicle.color : '#94a3b8';
                const borderColor = isSelected ? '#ffffff' : '#475569';
                const label = stop.stopSequence !== null ? String(stop.stopSequence + 1) : '•';

                return (
                  <Marker
                    key={stop.id}
                    position={[latLng.lat, latLng.lng]}
                    draggable
                    icon={stopDivIcon(pinColor, borderColor, label, stop.name)}
                    eventHandlers={{
                      click: () => onSelectStop(selectedStopId === stop.id ? null : stop.id),
                      mouseover: () => setHoveredStop(stop),
                      mouseout: () => setHoveredStop(null),
                      dragend: (e) => handleMarkerDragEnd(stop.id, e.target as L.Marker),
                    }}
                  />
                );
              })}

              {/* Vehicle Markers */}
              {vehicles.map((vehicle) => {
                const anim = animatedVehicles[vehicle.id];
                if (!anim || vehicle.metrics.loadUsed === 0) return null;
                const latLng = gridToLatLng(anim.x, anim.y);

                return (
                  <Marker
                    key={vehicle.id}
                    position={[latLng.lat, latLng.lng]}
                    icon={vehicleDivIcon(vehicle.color, vehicle.name.split(' ')[0])}
                    eventHandlers={{
                      click: () => onSelectVehicle(selectedVehicleId === vehicle.id ? null : vehicle.id),
                      mouseover: () => setHoveredVehicle(vehicle),
                      mouseout: () => setHoveredVehicle(null),
                    }}
                  />
                );
              })}

              {/* Road-following routes for each vehicle */}
              {vehicles.map((vehicle) => {
                const assignedStops = stops
                  .filter((s) => s.assignedVehicleId === vehicle.id)
                  .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0));

                if (assignedStops.length === 0) return null;

                const isSelected = selectedVehicleId === vehicle.id;

                return (
                  <RoadRoute
                    key={vehicle.id}
                    depot={gridToLatLng(depot.x, depot.y)}
                    waypoints={assignedStops.map((s) => stopToLatLng(s))}
                    color={vehicle.color}
                    isSelected={isSelected}
                  />
                );
              })}
            </MapContainer>

            {renderLegend()}
          </div>
        )}
      </div>

      {/* Hover Tooltips Panel */}
      {hoveredStop && (
        <div
          className={`absolute z-20 bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-lg text-xs text-slate-700 pointer-events-none ${
            viewMode === 'map' ? 'bottom-24 right-4 w-72' : ''
          }`}
          style={viewMode === 'grid' ? {
            left: `${Math.min(80, Math.max(2, hoveredStop.x))}%`,
            top: `${Math.min(75, Math.max(5, hoveredStop.y - 12))}%`,
          } : undefined}
        >
          <div className="flex items-center justify-between gap-4 mb-2">
            <h4 className="font-bold text-slate-800 text-sm">Stop {hoveredStop.stopSequence !== null ? hoveredStop.stopSequence + 1 : '•'}: {hoveredStop.name}</h4>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                hoveredStop.priority === 'High'
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : hoveredStop.priority === 'Medium'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {hoveredStop.priority}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-600 font-sans">
            <div>Customer: <span className="text-slate-800 font-bold">{hoveredStop.customer}</span></div>
            <div>Cargo Size: <span className="text-slate-800 font-mono font-bold">{hoveredStop.volume} boxes</span></div>
            <div className="col-span-2">Address: <span className="text-slate-700">{hoveredStop.address}</span></div>
            <div className="col-span-2 border-t border-slate-100 my-1"></div>
            <div>Window: <span className="text-amber-700 font-bold font-mono">
              {String(Math.floor(hoveredStop.timeWindowStart / 60) + 8).padStart(2, '0')}:
              {String(hoveredStop.timeWindowStart % 60).padStart(2, '0')} - {' '}
              {String(Math.floor(hoveredStop.timeWindowEnd / 60) + 8).padStart(2, '0')}:
              {String(hoveredStop.timeWindowEnd % 60).padStart(2, '0')}
            </span></div>
            <div>ETA: <span className="text-blue-600 font-bold font-mono">
              {hoveredStop.eta !== null
                ? `${String(Math.floor(hoveredStop.eta / 60) + 8).padStart(2, '0')}:${String(
                    hoveredStop.eta % 60
                  ).padStart(2, '0')}`
                : 'N/A'}
            </span></div>
            {hoveredStop.eta !== null && hoveredStop.eta > hoveredStop.timeWindowEnd && (
              <div className="col-span-2 text-red-700 font-bold flex items-center gap-1 mt-1 bg-red-50 p-1.5 rounded border border-red-200">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 animate-pulse text-red-600" />
                Delayed by {hoveredStop.eta - hoveredStop.timeWindowEnd} minutes!
              </div>
            )}
            {hoveredStop.eta !== null && hoveredStop.eta <= hoveredStop.timeWindowEnd && (
              <div className="col-span-2 text-emerald-700 font-bold flex items-center gap-1 mt-1 bg-emerald-50 p-1.5 rounded border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                Scheduled On Time
              </div>
            )}
          </div>
        </div>
      )}

      {hoveredVehicle && (
        <div
          className={`absolute z-20 bg-white border border-slate-200 p-4 rounded-xl shadow-lg text-xs text-slate-600 pointer-events-none ${
            viewMode === 'map' ? 'bottom-24 right-4 w-72' : ''
          }`}
          style={viewMode === 'grid' ? {
            left: `${Math.min(80, Math.max(2, animatedVehicles[hoveredVehicle.id]?.x ?? 50))}%`,
            top: `${Math.min(75, Math.max(5, (animatedVehicles[hoveredVehicle.id]?.y ?? 50) - 10))}%`,
          } : undefined}
        >
          <h4 className="font-bold text-slate-800 text-sm mb-2" style={{ color: hoveredVehicle.color }}>
            🚚 {hoveredVehicle.name}
          </h4>
          <div className="space-y-1 text-slate-600 font-sans">
            <div>Capacity: <span className="text-slate-800 font-mono font-bold">{hoveredVehicle.metrics.loadUsed} / {hoveredVehicle.capacity} boxes</span></div>
            <div>Distance: <span className="text-slate-800 font-mono font-bold">{hoveredVehicle.metrics.totalDistance} miles</span></div>
            <div>Delays: <span className="text-red-600 font-bold font-mono">{hoveredVehicle.metrics.delayCount} stops</span></div>
            <div>Route Cost: <span className="text-emerald-600 font-bold font-mono">${hoveredVehicle.metrics.totalCost}</span></div>
            <div className="border-t border-slate-100 my-1"></div>
            <div className="text-blue-600 font-bold">
              Status: {animatedVehicles[hoveredVehicle.id]?.statusText} @ {animatedVehicles[hoveredVehicle.id]?.currentStopName}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
