import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShoppingBag, Search, Plus, Trash2, MapPin, Sparkles, HelpCircle, TriangleAlert, Loader2 } from 'lucide-react';
import { Stop, Priority } from '../types';

const MAPS_KEY = (process.env.GOOGLE_MAPS_PLATFORM_KEY as string) || '';

// Geocode an address string → {lat, lng} using Google Geocoding API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

// Google Places Autocomplete input component
function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (address: string, lat: number, lng: number) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (autocompleteRef.current) return; // already initialized

    // The Google Maps script (with the Places library) loads asynchronously
    // and may not be ready yet when this component first mounts — poll until
    // it is, rather than checking once and silently giving up.
    const tryInit = () => {
      if (autocompleteRef.current || !inputRef.current || !(window as any).google?.maps?.places) {
        return false;
      }

      autocompleteRef.current = new (window as any).google.maps.places.Autocomplete(
        inputRef.current,
        { types: ['geocode', 'establishment'] }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const addr = place.formatted_address || place.name || '';
          onChange(addr);
          onSelect(addr, lat, lng);
        }
      });
      return true;
    };

    if (tryInit()) return;

    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 300);

    return () => clearInterval(interval);
  }, [onChange, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Search address...'}
      className="input"
      autoComplete="off"
    />
  );
}

interface OrderBookProps {
  stops: Stop[];
  onAddStop: (stop: Omit<Stop, 'id' | 'status' | 'assignedVehicleId' | 'stopSequence' | 'eta' | 'arrivalTime'>) => void;
  onDeleteStop: (id: string) => void;
  onLoadPreset: (presetName: string) => void;
  selectedStopId: string | null;
  onSelectStop: (id: string | null) => void;
  onClearAllStops: () => void;
  dispatchLat?: number;
  dispatchLng?: number;
}

export const OrderBook: React.FC<OrderBookProps> = ({
  stops, onAddStop, onDeleteStop, onLoadPreset,
  selectedStopId, onSelectStop, onClearAllStops,
  dispatchLat, dispatchLng,
}) => {
  const [filter, setFilter] = useState<'All' | 'Assigned' | 'Unassigned' | 'Delayed'>('All');
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [volume, setVolume] = useState(15);
  const [timeWindowStart, setTimeWindowStart] = useState(60);
  const [timeWindowEnd, setTimeWindowEnd] = useState(180);
  const [serviceDuration, setServiceDuration] = useState(20);
  const [priority, setPriority] = useState<Priority>('Medium');

  const handleAddressSelect = useCallback((addr: string, selLat: number, selLng: number) => {
    setAddress(addr);
    setLat(selLat);
    setLng(selLng);
    setGeoError('');
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !customer.trim()) return;

    let finalLat = lat;
    let finalLng = lng;

    // If user typed an address but didn't pick from autocomplete, geocode manually
    if (!finalLat && address.trim()) {
      setGeocoding(true);
      const coords = await geocodeAddress(address);
      setGeocoding(false);
      if (coords) {
        finalLat = coords.lat;
        finalLng = coords.lng;
      } else {
        setGeoError('Could not find address on map — check spelling or pick from suggestions.');
        return;
      }
    }

    // Convert real lat/lng to abstract x/y (relative to dispatch center)
    // This keeps the VRP optimizer working while we also have real coords
    const centerLat = dispatchLat ?? finalLat ?? 28.1518;
    const centerLng = dispatchLng ?? finalLng ?? -82.3743;
    const x = Math.min(100, Math.max(0, 50 + (finalLng! - centerLng) * 200));
    const y = Math.min(100, Math.max(0, 50 - (finalLat! - centerLat) * 200));

    onAddStop({
      name,
      customer,
      address: address || 'Unknown',
      lat: finalLat ?? undefined,
      lng: finalLng ?? undefined,
      volume,
      timeWindowStart,
      timeWindowEnd,
      serviceDuration,
      priority,
      x,
      y,
    });

    // Reset form
    setName(''); setCustomer(''); setAddress('');
    setLat(null); setLng(null); setGeoError('');
    setVolume(15); setIsAdding(false);
  };

  const filteredStops = stops.filter((stop) => {
    const matchesSearch =
      stop.name.toLowerCase().includes(search.toLowerCase()) ||
      stop.customer.toLowerCase().includes(search.toLowerCase()) ||
      stop.address.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'Assigned') return stop.assignedVehicleId !== null;
    if (filter === 'Unassigned') return stop.assignedVehicleId === null;
    if (filter === 'Delayed') return stop.arrivalTime !== null && stop.arrivalTime > stop.timeWindowEnd;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--surface)" }}>
      {/* Header */}
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ShoppingBag size={15} color="var(--green-dark)" /><span className="panel-title">Orders ({stops.length})</span>
        </div>
        <button
          onClick={() => { setIsAdding(!isAdding); setGeoError(''); }}
          className="btn btn-green btn-sm"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-3.5 h-3.5" /> Order</>}
        </button>
      </div>

      {/* Presets */}
      <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200/85 space-y-2">
        <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[10px] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          Load Routing Challenges / Presets
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['downtown', '🌆 Downtown Rush Hour'],
            ['suburban', '🏘️ Suburban Enterprise'],
            ['windows', '⏱️ Time Window Squeeze'],
            ['heavy-cargo', '📦 Heavy Cargo Peak'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => onLoadPreset(key)}
              className="px-2.5 py-1.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-left transition cursor-pointer shadow-xs">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search stops, address, customer..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-400" />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
          {(['All', 'Assigned', 'Unassigned', 'Delayed'] as const).map((opt) => {
            const count = opt === 'All' ? stops.length
              : opt === 'Assigned' ? stops.filter(s => s.assignedVehicleId).length
              : opt === 'Unassigned' ? stops.filter(s => !s.assignedVehicleId).length
              : stops.filter(s => s.arrivalTime !== null && s.arrivalTime > s.timeWindowEnd).length;
            return (
              <button key={opt} onClick={() => setFilter(opt)}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition text-center cursor-pointer ${filter === opt ? 'bg-white text-blue-600 shadow-xs border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'}`}>
                {opt} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable list + add form */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* Add Stop Form */}
        {isAdding && (
          <div className="bg-slate-50 p-4 border border-blue-200 rounded-xl space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Add Stop
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Stop Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Stop 1"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Customer *</label>
                <input value={customer} onChange={e => setCustomer(e.target.value)}
                  placeholder="e.g. Cornerstone"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">
                Destination Address
                {lat && lng && <span className="ml-2 text-green-600">✓ Pinned on map</span>}
              </label>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={handleAddressSelect}
                placeholder="Type address or search..."
              />
              {geoError && <p className="text-[10px] text-red-500 mt-1">{geoError}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Cargo Size</label>
                <input type="number" min="1" max="200" value={volume} onChange={e => setVolume(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Service (min)</label>
                <input type="number" min="5" max="120" value={serviceDuration} onChange={e => setServiceDuration(parseInt(e.target.value) || 20)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500">
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Window Open</label>
                <select value={timeWindowStart} onChange={e => setTimeWindowStart(parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500">
                  {[0,60,120,180,240,300,360].map(m => (
                    <option key={m} value={m}>{String(8+Math.floor(m/60)).padStart(2,'0')}:{String(m%60).padStart(2,'0')} {8+Math.floor(m/60)<12?'AM':'PM'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Window Close</label>
                <select value={timeWindowEnd} onChange={e => setTimeWindowEnd(parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500">
                  {[60,120,180,240,300,360,480].map(m => (
                    <option key={m} value={m}>{String(8+Math.floor(m/60)).padStart(2,'0')}:{String(m%60).padStart(2,'0')} {8+Math.floor(m/60)<12?'AM':'PM'}</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={geocoding || !name.trim() || !customer.trim()}
              className="btn btn-green" style={{ width: "100%", marginTop: 4 }}>
              {geocoding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Geocoding...</> : 'Add Stop'}
            </button>
          </div>
        )}

        {filteredStops.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
            <p className="text-xs font-medium">No stops yet.</p>
            <p className="text-[10px] text-slate-400 mt-1">Add a stop above or load a preset challenge!</p>
          </div>
        )}

        {filteredStops.map((stop) => {
          const isSelected = selectedStopId === stop.id;
          const isDelayed = stop.arrivalTime !== null && stop.arrivalTime > stop.timeWindowEnd;
          const fmt = (m: number) => `${String(8+Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

          return (
            <div key={stop.id} onClick={() => onSelectStop(isSelected ? null : stop.id)}
              className="card fade-in" style={{ margin: "0 12px 8px", padding: "12px 14px", cursor: "pointer", borderColor: isSelected ? "var(--green)" : "var(--border)", background: isSelected ? "#F0FDF4" : "var(--surface)", transition: "all .15s" }}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {stop.stopSequence !== null && (
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold">
                        {stop.stopSequence + 1}
                      </span>
                    )}
                    {stop.name}
                    {stop.lat && <span title="Pinned on map" className="text-green-500 text-[9px]">📍</span>}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{stop.customer} • {stop.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`pill ${stop.priority === "High" ? "pill-red" : stop.priority === "Medium" ? "pill-amber" : "pill-neutral"}`}>
                    {stop.priority}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteStop(stop.id); }}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100 p-2 rounded-lg font-mono text-[10px]">
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold mb-0.5">Target Window</span>
                  <span className="text-slate-700 font-semibold">{fmt(stop.timeWindowStart)} – {fmt(stop.timeWindowEnd)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold mb-0.5">ETA</span>
                  <span className={`font-bold ${isDelayed ? 'text-red-600 animate-pulse' : stop.eta ? 'text-blue-600' : 'text-slate-400'}`}>
                    {stop.eta !== null ? fmt(stop.eta) : 'Unscheduled'}
                  </span>
                </div>
              </div>

              {isDelayed && (
                <div className="flex items-center gap-1.5 text-red-700 bg-red-50 p-2 rounded-lg border border-red-200/50 text-[10px] font-semibold">
                  <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                  Time Window Overrun! Delay: {stop.arrivalTime! - stop.timeWindowEnd} mins
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span className="font-mono">Cargo: <strong className="text-slate-700">{stop.volume} units</strong></span>
                {stop.lat ? (
                  <span className="text-green-600 font-mono">{stop.lat.toFixed(4)}, {stop.lng?.toFixed(4)}</span>
                ) : (
                  <span className="font-mono">Grid: {Math.round(stop.x)}, {Math.round(stop.y)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {stops.length > 0 && (
        <button onClick={onClearAllStops}
          className="btn" style={{ width: "100%", marginTop: 12, background: "var(--red-light)", color: "var(--red)", border: "1px solid #FECACA" }}>
          Clear All Stops
        </button>
      )}
    </div>
  );
};
