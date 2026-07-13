import React, { useState } from 'react';
import { Truck, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Vehicle } from '../types';

interface FleetManagerProps {
  vehicles: Vehicle[];
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'status' | 'metrics'>) => void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  onDeleteVehicle: (id: string) => void;
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
}

const COLORS = ['#38bdf8','#fb7185','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16'];

export const FleetManager: React.FC<FleetManagerProps> = ({ vehicles, onAddVehicle, onUpdateVehicle, onDeleteVehicle, selectedVehicleId, onSelectVehicle }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [costPerMile, setCostPerMile] = useState(1.5);
  const [costPerHour, setCostPerHour] = useState(18.0);
  const [speed, setSpeed] = useState(1.5);
  const [color, setColor] = useState(COLORS[0]);
  const [shiftStart, setShiftStart] = useState(0);
  const [shiftEnd, setShiftEnd] = useState(480);

  const resetForm = () => { setName(''); setCapacity(100); setCostPerMile(1.5); setCostPerHour(18); setSpeed(1.5); setColor(COLORS[vehicles.length % COLORS.length]); setShiftStart(0); setShiftEnd(480); };

  const handleCreate = (e: any) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddVehicle({ name, capacity, shiftStart, shiftEnd, costPerMile, costPerHour, color, speed });
    resetForm(); setIsAdding(false);
  };

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id); setName(v.name); setCapacity(v.capacity);
    setCostPerMile(v.costPerMile); setCostPerHour(v.costPerHour);
    setSpeed(v.speed); setColor(v.color); setShiftStart(v.shiftStart); setShiftEnd(v.shiftEnd);
  };

  const handleSaveEdit = (id: string) => {
    onUpdateVehicle(id, { name, capacity, costPerMile, costPerHour, speed, color, shiftStart, shiftEnd });
    setEditingId(null);
  };

  const fmtShift = (m: number) => { const h = (Math.floor(m / 60) + 8) % 24; return `${String(h % 12 || 12).padStart(2,'0')}:${String(m % 60).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={15} color="var(--green-dark)" />
          <span className="panel-title">Crew Fleet ({vehicles.length})</span>
        </div>
        <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); resetForm(); }}
          className="btn btn-green btn-sm">
          {isAdding ? <><X size={11} /> Cancel</> : <><Plus size={11} /> Add</>}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {/* Add form */}
        {isAdding && (
          <form onSubmit={handleCreate}
            style={{ margin: 12, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div className="label-sm" style={{ marginBottom: 12, color: 'var(--green-dark)' }}>New Vehicle</div>
            <VehicleForm name={name} setName={setName} capacity={capacity} setCapacity={setCapacity}
              costPerMile={costPerMile} setCostPerMile={setCostPerMile} costPerHour={costPerHour} setCostPerHour={setCostPerHour}
              speed={speed} setSpeed={setSpeed} color={color} setColor={setColor}
              shiftStart={shiftStart} setShiftStart={setShiftStart} shiftEnd={shiftEnd} setShiftEnd={setShiftEnd} />
            <button type="submit" className="btn btn-green" style={{ width: '100%', marginTop: 12 }}>
              <Plus size={13} /> Add Vehicle
            </button>
          </form>
        )}

        {/* Vehicle list */}
        {vehicles.map(v => {
          const isSelected = selectedVehicleId === v.id;
          const isEditing = editingId === v.id;
          const statusColors: Record<string, string> = { Idle: 'pill-neutral', Active: 'pill-green', Returning: 'pill-amber', 'Off Shift': 'pill-neutral' };

          return (
            <div key={v.id} onClick={() => onSelectVehicle(v.id)}
              style={{ margin: '0 12px 8px', borderRadius: 'var(--radius)', border: `1px solid ${isSelected ? 'var(--green)' : 'var(--border)'}`, background: isSelected ? '#F0FDF4' : 'var(--surface)', boxShadow: 'var(--shadow)', transition: 'all .15s', cursor: 'pointer', overflow: 'hidden' }}>

              {isEditing ? (
                <div style={{ padding: 14 }}>
                  <VehicleForm name={name} setName={setName} capacity={capacity} setCapacity={setCapacity}
                    costPerMile={costPerMile} setCostPerMile={setCostPerMile} costPerHour={costPerHour} setCostPerHour={setCostPerHour}
                    speed={speed} setSpeed={setSpeed} color={color} setColor={setColor}
                    shiftStart={shiftStart} setShiftStart={setShiftStart} shiftEnd={shiftEnd} setShiftEnd={setShiftEnd} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={e => { e.stopPropagation(); handleSaveEdit(v.id); }} className="btn btn-green" style={{ flex: 1 }}>
                      <Check size={13} /> Save
                    </button>
                    <button onClick={e => { e.stopPropagation(); setEditingId(null); }} className="btn btn-ghost" style={{ flex: 1 }}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Color swatch */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: v.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Truck size={16} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginTop: 1 }}>
                        {fmtShift(v.shiftStart)} – {fmtShift(v.shiftEnd)} · Cap {v.capacity}
                      </div>
                    </div>
                    <span className={`pill ${statusColors[v.status] ?? 'pill-neutral'}`}>{v.status}</span>
                  </div>

                  {/* Metrics row */}
                  {v.metrics.loadUsed > 0 && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <Metric label="Load" value={`${v.metrics.loadUsed}/${v.capacity}`} />
                      <Metric label="Dist" value={`${v.metrics.totalDistance.toFixed(1)}`} />
                      <Metric label="Time" value={`${Math.round(v.metrics.totalTime)}m`} />
                      <Metric label="Cost" value={`$${v.metrics.totalCost.toFixed(0)}`} />
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button onClick={e => { e.stopPropagation(); startEdit(v); }}
                      className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                      <Edit2 size={11} /> Edit
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDeleteVehicle(v.id); }}
                      className="btn btn-sm"
                      style={{ background: 'var(--red-light)', color: 'var(--red)', border: 'none', flex: 1 }}>
                      <Trash2 size={11} /> Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="label-sm">{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginTop: 1 }}>{value}</div>
    </div>
  );
}

function VehicleForm({ name, setName, capacity, setCapacity, costPerMile, setCostPerMile, costPerHour, setCostPerHour, speed, setSpeed, color, setColor, shiftStart, setShiftStart, shiftEnd, setShiftEnd }: any) {
  const COLORS = ['#38bdf8','#fb7185','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FormField label="Name">
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Crew LM1 — Neri" />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <FormField label="Capacity"><input type="number" value={capacity} onChange={e => setCapacity(+e.target.value)} className="input" /></FormField>
        <FormField label="Speed"><input type="number" step="0.1" value={speed} onChange={e => setSpeed(+e.target.value)} className="input" /></FormField>
        <FormField label="$/mile"><input type="number" step="0.1" value={costPerMile} onChange={e => setCostPerMile(+e.target.value)} className="input" /></FormField>
        <FormField label="$/hour"><input type="number" step="0.5" value={costPerHour} onChange={e => setCostPerHour(+e.target.value)} className="input" /></FormField>
        <FormField label="Shift Start"><input type="number" value={shiftStart} onChange={e => setShiftStart(+e.target.value)} className="input" /></FormField>
        <FormField label="Shift End"><input type="number" value={shiftEnd} onChange={e => setShiftEnd(+e.target.value)} className="input" /></FormField>
      </div>
      <FormField label="Color">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text-1)' : '2px solid transparent', transition: 'border .1s' }} />
          ))}
        </div>
      </FormField>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-sm" style={{ marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
