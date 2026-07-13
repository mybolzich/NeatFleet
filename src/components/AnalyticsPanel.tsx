import React from 'react';
import { Sliders, Play, TrendingUp, Clock, Truck, AlertTriangle } from 'lucide-react';
import { Vehicle, Stop, OptimizerConfig } from '../types';

interface Props {
  vehicles: Vehicle[];
  stops: Stop[];
  config: OptimizerConfig;
  onUpdateConfig: (c: OptimizerConfig) => void;
  onOptimize: () => void;
}

export const AnalyticsPanel: React.FC<Props> = ({ vehicles, stops, config, onUpdateConfig, onOptimize }) => {
  const totalStops    = stops.length;
  const assigned      = stops.filter(s => s.assignedVehicleId).length;
  const delayed       = stops.filter(s => s.arrivalTime !== null && s.arrivalTime > s.timeWindowEnd).length;
  const totalDist     = vehicles.reduce((s, v) => s + v.metrics.totalDistance, 0);
  const totalTime     = vehicles.reduce((s, v) => s + v.metrics.totalTime, 0);
  const totalCost     = vehicles.reduce((s, v) => s + v.metrics.totalCost, 0);
  const activeCrews   = vehicles.filter(v => v.metrics.loadUsed > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={15} color="var(--green-dark)" />
          <span className="panel-title">Solver & Analytics</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }} className="no-scrollbar">

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <KpiCard icon={<TrendingUp size={14} color="var(--green-dark)" />} label="Total Distance" value={totalDist.toFixed(1)} unit="units" />
          <KpiCard icon={<Clock size={14} color="var(--blue)" />} label="Total Time" value={Math.round(totalTime)} unit="min" />
          <KpiCard icon={<Truck size={14} color="var(--amber)" />} label="Active Crews" value={`${activeCrews}/${vehicles.length}`} unit="" />
          <KpiCard icon={<AlertTriangle size={14} color="var(--red)" />} label="Delayed Stops" value={delayed} unit="" alert={delayed > 0} />
        </div>

        {/* Summary bar */}
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border)' }}>
          <div className="label-sm" style={{ marginBottom: 8 }}>Dispatch Summary</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Stat label="Assigned" value={`${assigned}/${totalStops}`} />
            <Stat label="Unassigned" value={totalStops - assigned} alert={(totalStops - assigned) > 0} />
            <Stat label="Total Cost" value={`$${totalCost.toFixed(0)}`} />
          </div>
        </div>

        {/* Solver config */}
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--border)' }}>
          <div className="label-sm" style={{ marginBottom: 12 }}>Optimizer Settings</div>

          <Toggle label="Minimize Vehicles" checked={config.minimizeVehicles}
            onChange={v => onUpdateConfig({ ...config, minimizeVehicles: v })} />
          <Toggle label="Traffic Aware" checked={config.trafficAware}
            onChange={v => onUpdateConfig({ ...config, trafficAware: v })} />

          <div style={{ marginTop: 12 }}>
            <SliderField label="Time Window Weight" value={config.timeWindowWeight} min={1} max={10}
              onChange={v => onUpdateConfig({ ...config, timeWindowWeight: v })} />
            <SliderField label="Capacity Weight" value={config.capacityWeight} min={1} max={10}
              onChange={v => onUpdateConfig({ ...config, capacityWeight: v })} />
          </div>
        </div>

        {/* Per-crew breakdown */}
        {activeCrews > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="label-sm" style={{ marginBottom: 8 }}>Crew Breakdown</div>
            {vehicles.filter(v => v.metrics.loadUsed > 0).map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{Math.round(v.metrics.loadUsed)}/{v.capacity}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{Math.round(v.metrics.totalTime)}m</span>
                <span style={{ fontSize: 10, color: 'var(--green-dark)', fontWeight: 700 }}>${v.metrics.totalCost.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onOptimize} disabled={stops.length === 0} className="btn btn-green"
          style={{ width: '100%', marginTop: 16 }}>
          <Play size={13} /> Run Optimizer
        </button>
      </div>
    </div>
  );
};

function KpiCard({ icon, label, value, unit, alert }: { icon: React.ReactNode; label: string; value: string | number; unit: string; alert?: boolean }) {
  return (
    <div style={{ background: alert ? '#FEF3C7' : 'var(--surface)', border: `1px solid ${alert ? '#FDE68A' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '10px 12px', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>{icon}<span className="label-sm">{label}</span></div>
      <div style={{ fontSize: 18, fontWeight: 800, color: alert ? 'var(--amber)' : 'var(--text-1)', letterSpacing: '-0.02em' }}>
        {value}{unit && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="label-sm">{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: alert ? 'var(--amber)' : 'var(--text-1)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{label}</span>
      <button onClick={() => onChange(!checked)} style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'background .2s',
        background: checked ? 'var(--green-dark)' : 'var(--border)', position: 'relative',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: checked ? 18 : 3, width: 14, height: 14,
          borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        }} />
      </button>
    </div>
  );
}

function SliderField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="label-sm">{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-dark)' }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: 'var(--green-dark)' }} />
    </div>
  );
}
