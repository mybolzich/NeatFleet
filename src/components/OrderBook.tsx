import React, { useState } from 'react';
import { ShoppingBag, Search, Plus, Trash2, Calendar, MapPin, Sparkles, HelpCircle, TriangleAlert } from 'lucide-react';
import { Stop, Priority, StopStatus } from '../types';

interface OrderBookProps {
  stops: Stop[];
  onAddStop: (stop: Omit<Stop, 'id' | 'status' | 'assignedVehicleId' | 'stopSequence' | 'eta' | 'arrivalTime'>) => void;
  onDeleteStop: (id: string) => void;
  onLoadPreset: (presetName: string) => void;
  selectedStopId: string | null;
  onSelectStop: (id: string | null) => void;
  onClearAllStops: () => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({
  stops,
  onAddStop,
  onDeleteStop,
  onLoadPreset,
  selectedStopId,
  onSelectStop,
  onClearAllStops,
}) => {
  const [filter, setFilter] = useState<'All' | 'Assigned' | 'Unassigned' | 'Delayed'>('All');
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState('');
  const [address, setAddress] = useState('');
  const [volume, setVolume] = useState(15);
  const [timeWindowStart, setTimeWindowStart] = useState(60); // 9:00 AM (60m from 8AM)
  const [timeWindowEnd, setTimeWindowEnd] = useState(180); // 11:00 AM (180m from 8AM)
  const [serviceDuration, setServiceDuration] = useState(20);
  const [priority, setPriority] = useState<Priority>('Medium');
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !customer.trim()) return;

    onAddStop({
      name,
      customer,
      address: address || '123 Main St, Metro City',
      volume,
      timeWindowStart,
      timeWindowEnd,
      serviceDuration,
      priority,
      x,
      y,
    });

    // Reset Form
    setName('');
    setCustomer('');
    setAddress('');
    setVolume(15);
    setIsAdding(false);
  };

  const filteredStops = stops.filter((stop) => {
    // Search filter
    const matchesSearch =
      stop.name.toLowerCase().includes(search.toLowerCase()) ||
      stop.customer.toLowerCase().includes(search.toLowerCase()) ||
      stop.address.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // Status filter
    if (filter === 'Assigned') return stop.assignedVehicleId !== null;
    if (filter === 'Unassigned') return stop.assignedVehicleId === null;
    if (filter === 'Delayed') return stop.arrivalTime !== null && stop.arrivalTime > stop.timeWindowEnd;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-xs">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">Order Book ({stops.length})</h2>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer shadow-xs"
          >
            {isAdding ? 'Cancel' : <><Plus className="w-3.5 h-3.5" /> Order</>}
          </button>
        </div>
      </div>

      {/* Preset Challenges Selector */}
      <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200/85 space-y-2">
        <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[10px] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          Load Routing Challenges / Presets
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onLoadPreset('downtown')}
            className="px-2.5 py-1.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-left transition cursor-pointer shadow-xs"
          >
            🌆 Downtown Rush Hour
          </button>
          <button
            onClick={() => onLoadPreset('suburban')}
            className="px-2.5 py-1.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-left transition cursor-pointer shadow-xs"
          >
            🏘️ Suburban Enterprise
          </button>
          <button
            onClick={() => onLoadPreset('windows')}
            className="px-2.5 py-1.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-left transition cursor-pointer shadow-xs"
          >
            ⏱️ Time Window Squeeze
          </button>
          <button
            onClick={() => onLoadPreset('heavy-cargo')}
            className="px-2.5 py-1.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-left transition cursor-pointer shadow-xs"
          >
            📦 Heavy Cargo Peak
          </button>
        </div>
      </div>

      {/* Search and Quick Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search stops, address, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 placeholder:text-slate-400 font-sans"
          />
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
          {(['All', 'Assigned', 'Unassigned', 'Delayed'] as const).map((opt) => {
            const count =
              opt === 'All'
                ? stops.length
                : opt === 'Assigned'
                ? stops.filter((s) => s.assignedVehicleId).length
                : opt === 'Unassigned'
                ? stops.filter((s) => !s.assignedVehicleId).length
                : stops.filter((s) => s.arrivalTime !== null && s.arrivalTime > s.timeWindowEnd).length;

            return (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition text-center cursor-pointer ${
                  filter === opt
                    ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200/30'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {opt} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Stop Builder Form */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isAdding && (
          <form onSubmit={handleSubmit} className="bg-slate-50 p-4 border border-blue-200 rounded-xl space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Manual Order Creator
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Stop Label</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Stop #11"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Customer</label>
                <input
                  type="text"
                  required
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="e.g. Amazon Hub"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Destination Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 789 Broadway St"
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Cargo Size</label>
                <input
                  type="number"
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value) || 5)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Service (min)</label>
                <input
                  type="number"
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(parseInt(e.target.value) || 10)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-sans focus:outline-none focus:border-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Window Open</label>
                <select
                  value={timeWindowStart}
                  onChange={(e) => setTimeWindowStart(parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value={0}>08:00 AM (Start)</option>
                  <option value={60}>09:00 AM</option>
                  <option value={120}>10:00 AM</option>
                  <option value={180}>11:00 AM</option>
                  <option value={240}>12:00 PM</option>
                  <option value={300}>01:00 PM</option>
                  <option value={360}>02:00 PM</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Window Close</label>
                <select
                  value={timeWindowEnd}
                  onChange={(e) => setTimeWindowEnd(parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value={120}>10:00 AM</option>
                  <option value={180}>11:00 AM</option>
                  <option value={240}>12:00 PM</option>
                  <option value={300}>01:00 PM</option>
                  <option value={360}>02:00 PM</option>
                  <option value={480}>04:00 PM (End)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">X Coordinate (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={x}
                  onChange={(e) => setX(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Y Coordinate (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={y}
                  onChange={(e) => setY(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              Add Stop
            </button>
          </form>
        )}

        {/* Empty list illustration */}
        {filteredStops.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
            <p className="text-xs font-medium">No matching orders found.</p>
            <p className="text-[10px] text-slate-400 mt-1">Try loading a challenge preset above!</p>
          </div>
        )}

        {/* Stops/Orders List */}
        {filteredStops.map((stop) => {
          const isSelected = selectedStopId === stop.id;

          const isDelayed = stop.arrivalTime !== null && stop.arrivalTime > stop.timeWindowEnd;

          // Time formatting
          const openStr = `${String(Math.floor(stop.timeWindowStart / 60) + 8).padStart(2, '0')}:${String(
            stop.timeWindowStart % 60
          ).padStart(2, '0')}`;
          const closeStr = `${String(Math.floor(stop.timeWindowEnd / 60) + 8).padStart(2, '0')}:${String(
            stop.timeWindowEnd % 60
          ).padStart(2, '0')}`;
          const etaStr =
            stop.eta !== null
              ? `${String(Math.floor(stop.eta / 60) + 8).padStart(2, '0')}:${String(stop.eta % 60).padStart(2, '0')}`
              : 'Unscheduled';

          return (
            <div
              key={stop.id}
              onClick={() => onSelectStop(isSelected ? null : stop.id)}
              className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-2.5 ${
                isSelected
                  ? 'bg-blue-50/20 border-blue-400 shadow-xs'
                  : 'bg-white hover:bg-slate-50/60 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {stop.stopSequence !== null && (
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold">
                        {stop.stopSequence + 1}
                      </span>
                    )}
                    {stop.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5">{stop.customer} • {stop.address}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                      stop.priority === 'High'
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : stop.priority === 'Medium'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {stop.priority}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStop(stop.id);
                    }}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Delivery Window & ETA */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100 p-2 rounded-lg font-mono text-[10px]">
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold mb-0.5">Target Window</span>
                  <span className="text-slate-700 font-semibold">{openStr} - {closeStr}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold mb-0.5">Estimated ETA</span>
                  <span className={`font-bold ${isDelayed ? 'text-red-600 animate-pulse' : stop.eta ? 'text-blue-600' : 'text-slate-400'}`}>
                    {etaStr}
                  </span>
                </div>
              </div>

              {/* Status details / warning */}
              {isDelayed && (
                <div className="flex items-center gap-1.5 text-red-700 bg-red-50 p-2 rounded-lg border border-red-200/50 text-[10px] font-semibold">
                  <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                  Time Window Overrun! Delay: {stop.arrivalTime! - stop.timeWindowEnd} mins
                </div>
              )}

              {/* Cargo Details */}
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span className="font-mono">Cargo: <strong className="text-slate-700 font-bold">{stop.volume} units</strong></span>
                <span>Coordinates: <strong className="text-slate-700 font-bold font-mono">{Math.round(stop.x)}, {Math.round(stop.y)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {stops.length > 0 && (
        <button
          onClick={onClearAllStops}
          className="mt-3 w-full py-2 bg-red-50 hover:bg-red-100/50 text-red-600 border border-red-200 text-xs font-bold rounded-lg transition cursor-pointer"
        >
          Clear All Stops
        </button>
      )}
    </div>
  );
};
