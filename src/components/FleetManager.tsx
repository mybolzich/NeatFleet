import React, { useState } from 'react';
import { Truck, Plus, Trash2, Edit2, Settings, Sliders, Check } from 'lucide-react';
import { Vehicle } from '../types';

interface FleetManagerProps {
  vehicles: Vehicle[];
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'status' | 'metrics'>) => void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  onDeleteVehicle: (id: string) => void;
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
}

const COLOR_PRESETS = [
  '#38bdf8', // sky-400
  '#fb7185', // rose-400
  '#f43f5e', // rose-500
  '#10b981', // emerald-500
  '#fbbf24', // amber-400
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
];

export const FleetManager: React.FC<FleetManagerProps> = ({
  vehicles,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  selectedVehicleId,
  onSelectVehicle,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for adding/editing
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [costPerMile, setCostPerMile] = useState(1.5);
  const [costPerHour, setCostPerHour] = useState(18.0);
  const [speed, setSpeed] = useState(1.5);
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [shiftStart, setShiftStart] = useState(0); // 8:00 AM
  const [shiftEnd, setShiftEnd] = useState(480); // 4:00 PM

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddVehicle({
      name,
      capacity,
      shiftStart,
      shiftEnd,
      costPerMile,
      costPerHour,
      color,
      speed,
    });

    // Reset Form
    setName('');
    setCapacity(100);
    setCostPerMile(1.5);
    setCostPerHour(18.0);
    setSpeed(1.5);
    setColor(COLOR_PRESETS[vehicles.length % COLOR_PRESETS.length]);
    setIsAdding(false);
  };

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setName(v.name);
    setCapacity(v.capacity);
    setCostPerMile(v.costPerMile);
    setCostPerHour(v.costPerHour);
    setSpeed(v.speed);
    setColor(v.color);
    setShiftStart(v.shiftStart);
    setShiftEnd(v.shiftEnd);
  };

  const handleSaveEdit = (id: string) => {
    onUpdateVehicle(id, {
      name,
      capacity,
      costPerMile,
      costPerHour,
      speed,
      color,
      shiftStart,
      shiftEnd,
    });
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-800">Fleet Control ({vehicles.length})</h2>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer shadow-xs"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-3.5 h-3.5" /> Add Vehicle</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        {/* Add Vehicle Form */}
        {isAdding && (
          <form onSubmit={handleCreate} className="bg-slate-50 p-4 rounded-xl border border-blue-100 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">New Delivery Truck</h3>
            <div>
              <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Truck ID / Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. RouteMaster Express"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Max Cargo Capacity</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 10)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Driver Speed</label>
                <input
                  type="number"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Cost / Mile ($)</label>
                <input
                  type="number"
                  step="0.1"
                  value={costPerMile}
                  onChange={(e) => setCostPerMile(parseFloat(e.target.value) || 1.0)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Driver Hour Rate ($)</label>
                <input
                  type="number"
                  step="0.5"
                  value={costPerHour}
                  onChange={(e) => setCostPerHour(parseFloat(e.target.value) || 10.0)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1.5">Route Line Color</label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setColor(p)}
                    className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                      color === p ? 'border-slate-400 scale-110 shadow-xs' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: p }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold transition mt-2 cursor-pointer shadow-xs"
            >
              Add to Fleet
            </button>
          </form>
        )}

        {/* Vehicles List */}
        {vehicles.map((vehicle) => {
          const isSelected = selectedVehicleId === vehicle.id;
          const isEditing = editingId === vehicle.id;

          // Capacity usage ratio
          const utilization = vehicle.capacity > 0 ? (vehicle.metrics.loadUsed / vehicle.capacity) * 100 : 0;
          const progressColor = utilization > 90 ? 'bg-red-500' : utilization > 50 ? 'bg-amber-500' : 'bg-blue-600';

          return (
            <div
              key={vehicle.id}
              onClick={() => {
                if (!isEditing) {
                  onSelectVehicle(isSelected ? null : vehicle.id);
                }
              }}
              className={`group relative p-4 rounded-xl border transition cursor-pointer flex flex-col gap-3 ${
                isSelected
                  ? 'bg-blue-50/20 border-blue-400 shadow-xs'
                  : 'bg-white hover:bg-slate-50/60 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Card Top / Identifiers */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: vehicle.color }}
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 max-w-[120px] focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        {vehicle.name}
                      </h3>
                      <p className="text-[10px] text-slate-500">Speed: {vehicle.speed}x • Shift: 08:00 AM - 04:00 PM</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150" onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <button
                      onClick={() => handleSaveEdit(vehicle.id)}
                      className="p-1 hover:bg-slate-100 text-emerald-600 rounded-lg transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => startEdit(vehicle)}
                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteVehicle(vehicle.id)}
                    disabled={vehicles.length <= 1}
                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition disabled:opacity-30 disabled:hover:text-slate-450 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Editing Expanded Fields */}
              {isEditing && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200" onClick={e => e.stopPropagation()}>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block mb-1">CAPACITY</span>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-slate-200 px-1.5 py-0.5 text-[11px] font-mono rounded text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold block mb-1">SPEED</span>
                    <input
                      type="number"
                      step="0.1"
                      value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value) || 1.0)}
                      className="w-full bg-white border border-slate-200 px-1.5 py-0.5 text-[11px] font-mono rounded text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Capacity Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Cargo Load Utilization</span>
                  <span className="font-bold text-slate-700">{vehicle.metrics.loadUsed} / {vehicle.capacity} cargo units ({Math.round(utilization)}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                    style={{ width: `${Math.min(100, utilization)}%` }}
                  />
                </div>
              </div>

              {/* Statistics Overview */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100 p-2 rounded-lg text-[10px] text-slate-600 font-mono">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold mb-0.5">Dist</span>
                  <span className="text-slate-800 font-bold">{vehicle.metrics.totalDistance} mi</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold mb-0.5">Time</span>
                  <span className="text-slate-800 font-bold">{vehicle.metrics.totalTime} mins</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold mb-0.5">Cost</span>
                  <span className="text-emerald-600 font-bold">${vehicle.metrics.totalCost}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
