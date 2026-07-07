import { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Activity,
  Truck,
  ShoppingBag,
  BarChart,
  Sparkles,
  RefreshCw,
  Sliders,
  HelpCircle,
  Download
} from 'lucide-react';
import { Stop, Vehicle, Depot, TrafficZone, OptimizerConfig, SimulationState } from './types';
import { optimizeRoutes } from './utils/optimizer';
import { InteractiveMap } from './components/InteractiveMap';
import { FleetManager } from './components/FleetManager';
import { OrderBook } from './components/OrderBook';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { AICopilot } from './components/AICopilot';
import { AuthScreen } from './components/AuthScreen';
import { useAuth } from './lib/useAuth';
import { useCloudSync } from './lib/useCloudSync';

// Initial baseline Depot and Traffic zones
const CENTRAL_DEPOT: Depot = { x: 50, y: 50, address: 'Central Metro Depot, Main Ave' };

const INITIAL_TRAFFIC: TrafficZone[] = [
  { id: 't1', name: 'Downtown Congestion', x: 50, y: 50, radius: 18, delayFactor: 2.2 },
  { id: 't2', name: 'North Highway Toll Road', x: 75, y: 25, radius: 12, delayFactor: 1.6 },
];

const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    name: 'Rapid Van A',
    capacity: 120,
    shiftStart: 0,
    shiftEnd: 480,
    costPerMile: 1.2,
    costPerHour: 15.0,
    color: '#38bdf8', // sky-400
    speed: 1.6,
    status: 'Idle',
    metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
  },
  {
    id: 'v2',
    name: 'Heavy Truck B',
    capacity: 250,
    shiftStart: 0,
    shiftEnd: 480,
    costPerMile: 2.1,
    costPerHour: 22.0,
    color: '#fb7185', // rose-400
    speed: 1.1,
    status: 'Idle',
    metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
  },
  {
    id: 'v3',
    name: 'Eco Transit C',
    capacity: 80,
    shiftStart: 30, // Starts at 8:30 AM
    shiftEnd: 480,
    costPerMile: 0.9,
    costPerHour: 14.0,
    color: '#10b981', // emerald-500
    speed: 1.8,
    status: 'Idle',
    metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
  },
];

const INITIAL_STOPS: Stop[] = [
  {
    id: 's1',
    name: 'Market Square Mall',
    customer: 'Target Stores Inc',
    x: 35,
    y: 30,
    address: '450 Market Sq, Downtown',
    volume: 35,
    timeWindowStart: 30, // 8:30 AM
    timeWindowEnd: 150, // 10:30 AM
    serviceDuration: 25,
    priority: 'High',
    status: 'Pending',
    assignedVehicleId: null,
    stopSequence: null,
    eta: null,
    arrivalTime: null,
  },
  {
    id: 's2',
    name: 'Broad St Pharmacy',
    customer: 'CVS Healthcare',
    x: 65,
    y: 40,
    address: '902 Broad St, East Core',
    volume: 15,
    timeWindowStart: 60, // 9:00 AM
    timeWindowEnd: 180, // 11:00 AM
    serviceDuration: 15,
    priority: 'Medium',
    status: 'Pending',
    assignedVehicleId: null,
    stopSequence: null,
    eta: null,
    arrivalTime: null,
  },
  {
    id: 's3',
    name: 'Riverside Warehouse',
    customer: 'Genco Logistics',
    x: 80,
    y: 70,
    address: '14 River Rd, Outer East',
    volume: 90,
    timeWindowStart: 90, // 9:30 AM
    timeWindowEnd: 300, // 1:00 PM
    serviceDuration: 40,
    priority: 'High',
    status: 'Pending',
    assignedVehicleId: null,
    stopSequence: null,
    eta: null,
    arrivalTime: null,
  },
  {
    id: 's4',
    name: 'Midtown Grocery',
    customer: 'Whole Foods Market',
    x: 25,
    y: 65,
    address: '12 Midtown Plaza, West Core',
    volume: 45,
    timeWindowStart: 120, // 10:00 AM
    timeWindowEnd: 240, // 12:00 PM
    serviceDuration: 20,
    priority: 'Low',
    status: 'Pending',
    assignedVehicleId: null,
    stopSequence: null,
    eta: null,
    arrivalTime: null,
  },
  {
    id: 's5',
    name: 'Silicon Labs Hub',
    customer: 'Google Corp',
    x: 45,
    y: 85,
    address: '101 Google Way, South Campus',
    volume: 60,
    timeWindowStart: 180, // 11:00 AM
    timeWindowEnd: 360, // 2:00 PM
    serviceDuration: 30,
    priority: 'Medium',
    status: 'Pending',
    assignedVehicleId: null,
    stopSequence: null,
    eta: null,
    arrivalTime: null,
  },
];

export default function App() {
  const auth = useAuth();

  const [stops, setStops] = useState<Stop[]>(INITIAL_STOPS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [depot, setDepot] = useState<Depot>(CENTRAL_DEPOT);
  const [trafficZones, setTrafficZones] = useState<TrafficZone[]>(INITIAL_TRAFFIC);

  useCloudSync(
    auth.company?.$id || null,
    stops, setStops,
    vehicles, setVehicles,
    depot, setDepot,
    trafficZones, setTrafficZones,
  );

  // Optimizer parameters
  const [config, setConfig] = useState<OptimizerConfig>({
    minimizeVehicles: false,
    timeWindowWeight: 4,
    capacityWeight: 5,
    trafficAware: true,
  });

  // Selected elements for highlight
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Active side-view tabs
  const [leftTab, setLeftTab] = useState<'orders' | 'fleet'>('orders');
  const [rightTab, setRightTab] = useState<'analytics' | 'copilot'>('analytics');

  // Simulation parameters
  const [simulationTime, setSimulationTime] = useState<number>(0); // mins from 8:00 AM (0 to 480)
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1); // real-time factor
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger solver optimization run automatically on data adjustments
  const triggerOptimization = () => {
    const { optimizedStops, optimizedVehicles } = optimizeRoutes(
      stops,
      vehicles,
      depot,
      trafficZones,
      config
    );
    setStops(optimizedStops);
    setVehicles(optimizedVehicles);
  };

  // Perform initial route optimization upon boot
  useEffect(() => {
    triggerOptimization();
  }, [config, depot, trafficZones]);

  // Simulation ticks loop
  useEffect(() => {
    if (isSimulating) {
      simIntervalRef.current = setInterval(() => {
        setSimulationTime((prev) => {
          if (prev >= 480) {
            setIsSimulating(false);
            return 480;
          }
          return prev + simSpeed;
        });
      }, 100);
    } else {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    }

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isSimulating, simSpeed]);

  // Handle Stop/Order modifications
  const handleAddStop = (newStop: Omit<Stop, 'id' | 'status' | 'assignedVehicleId' | 'stopSequence' | 'eta' | 'arrivalTime'>) => {
    const stop: Stop = {
      ...newStop,
      id: `s-${Date.now()}`,
      status: 'Pending',
      assignedVehicleId: null,
      stopSequence: null,
      eta: null,
      arrivalTime: null,
    };
    setStops((prev) => {
      const updated = [...prev, stop];
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(updated, vehicles, depot, trafficZones, config);
      setVehicles(optimizedVehicles);
      return optimizedStops;
    });
  };

  const handleUpdateStopCoords = (id: string, x: number, y: number) => {
    setStops((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, x, y } : s));
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(updated, vehicles, depot, trafficZones, config);
      setVehicles(optimizedVehicles);
      return optimizedStops;
    });
  };

  const handleDeleteStop = (id: string) => {
    setStops((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(updated, vehicles, depot, trafficZones, config);
      setVehicles(optimizedVehicles);
      return optimizedStops;
    });
    if (selectedStopId === id) setSelectedStopId(null);
  };

  const handleClearAllStops = () => {
    setStops([]);
    setVehicles(prev => prev.map(v => ({
      ...v,
      metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 }
    })));
    setSelectedStopId(null);
  };

  // Add click to map coordinates handler
  const handleMapClickAdd = (x: number, y: number) => {
    handleAddStop({
      name: `Drop #${stops.length + 1}`,
      customer: `Merchant Vendor #${Math.floor(Math.random() * 80) + 10}`,
      address: `${Math.floor(Math.random() * 900) + 100} Elm St`,
      volume: Math.floor(Math.random() * 25) + 10,
      timeWindowStart: 60, // 9AM
      timeWindowEnd: 300, // 1PM
      serviceDuration: 15,
      priority: 'Medium',
      x,
      y,
    });
  };

  // Handle Fleet/Vehicle modifications
  const handleAddVehicle = (newVehicle: Omit<Vehicle, 'id' | 'status' | 'metrics'>) => {
    const vehicle: Vehicle = {
      ...newVehicle,
      id: `v-${Date.now()}`,
      status: 'Idle',
      metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
    };
    setVehicles((prev) => {
      const updated = [...prev, vehicle];
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(stops, updated, depot, trafficZones, config);
      setStops(optimizedStops);
      return optimizedVehicles;
    });
  };

  const handleUpdateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setVehicles((prev) => {
      const updated = prev.map((v) => (v.id === id ? { ...v, ...updates } : v));
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(stops, updated, depot, trafficZones, config);
      setStops(optimizedStops);
      return optimizedVehicles;
    });
  };

  const handleDeleteVehicle = (id: string) => {
    if (vehicles.length <= 1) return;
    setVehicles((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(stops, updated, depot, trafficZones, config);
      setStops(optimizedStops);
      return optimizedVehicles;
    });
    if (selectedVehicleId === id) setSelectedVehicleId(null);
  };

  // Preset dispatcher scenarios
  const handleLoadPreset = (presetName: string) => {
    // Stop simulation
    setIsSimulating(false);
    setSimulationTime(0);

    if (presetName === 'downtown') {
      // Small core radius, heavy traffic congestion, tight windows
      setDepot({ x: 50, y: 50, address: 'Central Downtown Core Depot' });
      setTrafficZones([
        { id: 't1', name: 'Broadway Rush Traffic', x: 50, y: 50, radius: 24, delayFactor: 2.8 },
      ]);
      setVehicles([
        {
          id: 'v1',
          name: 'City Courier Alpha',
          capacity: 100,
          shiftStart: 0,
          shiftEnd: 480,
          costPerMile: 1.1,
          costPerHour: 14.0,
          color: '#38bdf8',
          speed: 1.5,
          status: 'Idle',
          metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
        },
        {
          id: 'v2',
          name: 'City Courier Beta',
          capacity: 100,
          shiftStart: 0,
          shiftEnd: 480,
          costPerMile: 1.1,
          costPerHour: 14.0,
          color: '#fb7185',
          speed: 1.5,
          status: 'Idle',
          metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
        },
      ]);
      const newStops: Stop[] = [
        { id: 's1', name: 'Broadway Plaza', customer: 'Macys Dept', x: 42, y: 45, address: '14 Broadway Ave', volume: 20, timeWindowStart: 0, timeWindowEnd: 90, serviceDuration: 15, priority: 'High', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's2', name: 'Commerce Towers', customer: 'Chase Corp', x: 58, y: 52, address: '88 Wall St', volume: 15, timeWindowStart: 30, timeWindowEnd: 120, serviceDuration: 15, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's3', name: 'Federal Court Office', customer: 'US Postal Service', x: 52, y: 38, address: '2 Constitution Sq', volume: 25, timeWindowStart: 60, timeWindowEnd: 150, serviceDuration: 20, priority: 'High', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's4', name: 'Convention Center', customer: 'Catering Partners', x: 38, y: 58, address: '404 Exhibit Blvd', volume: 40, timeWindowStart: 60, timeWindowEnd: 180, serviceDuration: 25, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's5', name: 'Fashion District Boutique', customer: 'Zara Apparel', x: 48, y: 62, address: '900 Retail Row', volume: 18, timeWindowStart: 120, timeWindowEnd: 240, serviceDuration: 15, priority: 'Low', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
      ];
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(newStops, [
        {
          id: 'v1',
          name: 'City Courier Alpha',
          capacity: 100,
          shiftStart: 0,
          shiftEnd: 480,
          costPerMile: 1.1,
          costPerHour: 14.0,
          color: '#38bdf8',
          speed: 1.5,
          status: 'Idle',
          metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
        },
        {
          id: 'v2',
          name: 'City Courier Beta',
          capacity: 100,
          shiftStart: 0,
          shiftEnd: 480,
          costPerMile: 1.1,
          costPerHour: 14.0,
          color: '#fb7185',
          speed: 1.5,
          status: 'Idle',
          metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
        },
      ], { x: 50, y: 50, address: 'Central Downtown Core Depot' }, [
        { id: 't1', name: 'Broadway Rush Traffic', x: 50, y: 50, radius: 24, delayFactor: 2.8 },
      ], config);
      setStops(optimizedStops);
      setVehicles(optimizedVehicles);
    } else if (presetName === 'suburban') {
      // Spread out stops, peripheral depot, large cargo volume
      setDepot({ x: 10, y: 10, address: 'Western Manufacturing Hub' });
      setTrafficZones([]);
      const fleet: Vehicle[] = [
        {
          id: 'v1',
          name: 'Heavy Duty Truck X',
          capacity: 200,
          shiftStart: 0,
          shiftEnd: 480,
          costPerMile: 2.5,
          costPerHour: 24.0,
          color: '#38bdf8',
          speed: 1.3,
          status: 'Idle',
          metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
        },
        {
          id: 'v2',
          name: 'Heavy Duty Truck Y',
          capacity: 200,
          shiftStart: 0,
          shiftEnd: 480,
          costPerMile: 2.5,
          costPerHour: 24.0,
          color: '#f43f5e',
          speed: 1.3,
          status: 'Idle',
          metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 },
        },
      ];
      const suburbanStops: Stop[] = [
        { id: 's1', name: 'Eastside Industrial Park', customer: 'Boeing Aerospace', x: 85, y: 75, address: '100 Terminal Way', volume: 110, timeWindowStart: 60, timeWindowEnd: 300, serviceDuration: 30, priority: 'High', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's2', name: 'North Creek Retail Hub', customer: 'Walmart Supercenter', x: 75, y: 20, address: '500 Commerce Rd', volume: 80, timeWindowStart: 30, timeWindowEnd: 240, serviceDuration: 25, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's3', name: 'Valley Logistics Terminal', customer: 'FedEx SmartPost', x: 20, y: 80, address: '88 Industrial Blvd', volume: 90, timeWindowStart: 0, timeWindowEnd: 180, serviceDuration: 20, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's4', name: 'Lakeside Tech Complex', customer: 'Microsoft Corp', x: 90, y: 30, address: '999 Lakeside Dr', volume: 60, timeWindowStart: 120, timeWindowEnd: 360, serviceDuration: 15, priority: 'Low', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
      ];
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(suburbanStops, fleet, { x: 10, y: 10, address: 'Western Manufacturing Hub' }, [], config);
      setStops(optimizedStops);
      setVehicles(optimizedVehicles);
    } else if (presetName === 'windows') {
      // High count of stops with highly restrictive overlapping time windows
      setDepot({ x: 50, y: 50, address: 'Central Metro Depot' });
      setTrafficZones([
        { id: 't1', name: 'West Cross Traffic', x: 30, y: 50, radius: 10, delayFactor: 1.8 },
      ]);
      const fleet: Vehicle[] = [
        { id: 'v1', name: 'Time Critical Van 1', capacity: 100, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 16.0, color: '#38bdf8', speed: 1.7, status: 'Idle', metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 } },
        { id: 'v2', name: 'Time Critical Van 2', capacity: 100, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 16.0, color: '#fbbf24', speed: 1.7, status: 'Idle', metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 } },
        { id: 'v3', name: 'Time Critical Van 3', capacity: 100, shiftStart: 0, shiftEnd: 480, costPerMile: 1.2, costPerHour: 16.0, color: '#a855f7', speed: 1.7, status: 'Idle', metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 } },
      ];
      const windowStops: Stop[] = [
        { id: 's1', name: 'Medical Diagnostic Labs', customer: 'Quest Diagnostics', x: 20, y: 30, address: '12 Clinic Ave', volume: 10, timeWindowStart: 15, timeWindowEnd: 75, serviceDuration: 15, priority: 'High', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's2', name: 'Urgent Care Center', customer: 'Valley Health Clinic', x: 35, y: 70, address: '77 Urgent Dr', volume: 15, timeWindowStart: 15, timeWindowEnd: 90, serviceDuration: 20, priority: 'High', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's3', name: 'Airport Cargo Express', customer: 'DHL Air Operations', x: 85, y: 45, address: '9 Aviation Dr', volume: 40, timeWindowStart: 45, timeWindowEnd: 120, serviceDuration: 30, priority: 'High', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's4', name: 'Corporate Banking Block', customer: 'Bank of America', x: 60, y: 15, address: '44 Financial Pl', volume: 20, timeWindowStart: 90, timeWindowEnd: 150, serviceDuration: 15, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's5', name: 'Tech Inc HQ', customer: 'Intel Corp Research', x: 70, y: 80, address: '500 Microchip Dr', volume: 25, timeWindowStart: 120, timeWindowEnd: 180, serviceDuration: 15, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
      ];
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(windowStops, fleet, { x: 50, y: 50, address: 'Central Metro Depot' }, [
        { id: 't1', name: 'West Cross Traffic', x: 30, y: 50, radius: 10, delayFactor: 1.8 },
      ], config);
      setStops(optimizedStops);
      setVehicles(optimizedVehicles);
    } else if (presetName === 'heavy-cargo') {
      // Cargo sizes exceed truck capabilities, requiring smart load splits or consolidations
      setDepot({ x: 50, y: 50, address: 'Central Bulk Cargo Depot' });
      setTrafficZones([]);
      const fleet: Vehicle[] = [
        { id: 'v1', name: 'Super Loader Truck A', capacity: 150, shiftStart: 0, shiftEnd: 480, costPerMile: 2.8, costPerHour: 25.0, color: '#38bdf8', speed: 1.0, status: 'Idle', metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 } },
        { id: 'v2', name: 'Compact Transit B', capacity: 60, shiftStart: 0, shiftEnd: 480, costPerMile: 1.0, costPerHour: 14.0, color: '#10b981', speed: 1.8, status: 'Idle', metrics: { totalDistance: 0, totalTime: 0, loadUsed: 0, delayCount: 0, totalCost: 0 } },
      ];
      const cargoStops: Stop[] = [
        { id: 's1', name: 'Heavy Metal Foundry', customer: 'US Steel Yards', x: 20, y: 25, address: '3 Yard Rd', volume: 130, timeWindowStart: 30, timeWindowEnd: 240, serviceDuration: 40, priority: 'High', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's2', name: 'Chemical Supply Depot', customer: 'DuPont Dist', x: 80, y: 80, address: '12 Chem Way', volume: 55, timeWindowStart: 60, timeWindowEnd: 180, serviceDuration: 25, priority: 'Medium', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
        { id: 's3', name: 'Construction Site B', customer: 'Caterpillar Dev', x: 75, y: 30, address: '90 Builders Row', volume: 45, timeWindowStart: 120, timeWindowEnd: 300, serviceDuration: 15, priority: 'Low', status: 'Pending', assignedVehicleId: null, stopSequence: null, eta: null, arrivalTime: null },
      ];
      const { optimizedStops, optimizedVehicles } = optimizeRoutes(cargoStops, fleet, { x: 50, y: 50, address: 'Central Bulk Cargo Depot' }, [], config);
      setStops(optimizedStops);
      setVehicles(optimizedVehicles);
    }
  };

  const handleExportRouteData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      depot: depot,
      stops: stops.map(s => ({
        id: s.id,
        name: s.name,
        customer: s.customer,
        address: s.address,
        volume: s.volume,
        priority: s.priority,
        coordinates: { x: s.x, y: s.y },
        assignedVehicleId: s.assignedVehicleId,
        stopSequence: s.stopSequence,
        eta: s.eta !== null ? `${String(Math.floor(s.eta / 60) + 8).padStart(2, '0')}:${String(s.eta % 60).padStart(2, '0')}` : null,
        status: s.status
      })),
      vehicles: vehicles.map(v => ({
        id: v.id,
        name: v.name,
        capacity: v.capacity,
        color: v.color,
        speed: v.speed,
        shift: `${String(Math.floor(v.shiftStart / 60) + 8).padStart(2, '0')}:${String(v.shiftStart % 60).padStart(2, '0')} - ${String(Math.floor(v.shiftEnd / 60) + 8).padStart(2, '0')}:${String(v.shiftEnd % 60).padStart(2, '0')}`,
        metrics: {
          totalDistance: v.metrics.totalDistance,
          totalTimeMinutes: v.metrics.totalTime,
          loadUsed: v.metrics.loadUsed,
          capacityUtilization: `${Math.round((v.metrics.loadUsed / v.capacity) * 100)}%`,
          delayCount: v.metrics.delayCount,
          totalCostUSD: v.metrics.totalCost
        },
        stopsRoute: stops
          .filter(s => s.assignedVehicleId === v.id)
          .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0))
          .map(s => s.name)
      })),
      totalMetrics: {
        totalDistance: vehicles.reduce((sum, v) => sum + v.metrics.totalDistance, 0),
        totalCost: vehicles.reduce((sum, v) => sum + v.metrics.totalCost, 0),
        slaDelayedCount: stops.filter((s) => s.eta !== null && s.eta > s.timeWindowEnd).length,
        slaOnTimeCount: stops.filter((s) => s.eta !== null && s.eta <= s.timeWindowEnd).length,
        unassignedStops: stops.filter((s) => !s.assignedVehicleId).length
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `route_dispatch_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!auth.company) {
    return <AuthScreen auth={auth} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans select-none overflow-hidden antialiased">
      {/* 1. Global Navigation Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200">
            <Compass className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-1.5 uppercase">
              RouteManager Studio <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">Enterprise</span>
            </h1>
            <p className="text-xs text-slate-500">Tactical Route Optimization & Dispatch Command Board</p>
          </div>
        </div>

        {/* Global Dispatch Progress */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-xs">
            <Activity className="w-4 h-4 text-emerald-600" />
            <div className="text-xs">
              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Scheduled Drops</span>
              <span className="font-bold text-slate-900 font-mono">
                {stops.filter((s) => s.assignedVehicleId).length} / {stops.length} Orders
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-xs">
            <Truck className="w-4 h-4 text-blue-600" />
            <div className="text-xs">
              <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Operational Fleet</span>
              <span className="font-bold text-slate-900 font-mono">
                {vehicles.filter((v) => v.metrics.loadUsed > 0).length} / {vehicles.length} Active
              </span>
            </div>
          </div>

          <button
            id="export-route-data-btn"
            onClick={handleExportRouteData}
            className="flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-xs cursor-pointer border border-blue-700/50 hover:shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export Route Data</span>
          </button>

          <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900">{auth.company?.name}</div>
              <div className="text-[10px] text-slate-500">{auth.profile?.fullName} · {auth.profile?.role}</div>
            </div>
            <button
              onClick={() => auth.logout()}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* 2. Simulation Controller & Global Clock HUD */}
      <section className="flex flex-wrap items-center justify-between px-6 py-3 bg-white border-b border-slate-200 gap-4">
        {/* Simulation Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              isSimulating
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
            }`}
          >
            {isSimulating ? <><Pause className="w-4 h-4" /> Pause Simulation</> : <><Play className="w-4 h-4" /> Start Simulation</>}
          </button>

          <button
            onClick={() => {
              setIsSimulating(false);
              setSimulationTime(0);
            }}
            className="flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
            title="Reset simulation to 8:00 AM"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {([1, 2, 5, 10] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => setSimSpeed(speed)}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  simSpeed === speed ? 'bg-white text-blue-600 font-extrabold shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Global Simulated Progress Slider */}
        <div className="flex-1 max-w-xl flex items-center gap-4">
          <span className="text-[10px] text-slate-500 font-mono">08:00 AM</span>
          <input
            type="range"
            min="0"
            max="480"
            value={simulationTime}
            onChange={(e) => {
              setIsSimulating(false);
              setSimulationTime(parseInt(e.target.value));
            }}
            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-[10px] text-slate-500 font-mono">04:00 PM</span>
        </div>

        {/* Active Simulation Status Badge */}
        <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 shadow-xs">
          <span className="text-slate-500 font-mono">Simulation Time:</span>
          <span className="text-blue-600 font-bold font-mono">
            {String(Math.floor(simulationTime / 60) + 8).padStart(2, '0')}:
            {String(simulationTime % 60).padStart(2, '0')}{' '}
            {Math.floor(simulationTime / 60) + 8 < 12 ? 'AM' : 'PM'}
          </span>
          <span className="text-slate-300">|</span>
          <span className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
        </div>
      </section>

      {/* 3. Three-Column Workspace Dashboard */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4 bg-slate-50">
        {/* Left Column (Order Book & Fleet Tab Control) */}
        <section className="w-1/4 min-w-[320px] max-w-[400px] flex flex-col gap-3 h-full">
          {/* Custom Tabs */}
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-200/60 shadow-xs">
            <button
              onClick={() => setLeftTab('orders')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                leftTab === 'orders'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Order Book
            </button>
            <button
              onClick={() => setLeftTab('fleet')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                leftTab === 'fleet'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Fleet Control
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {leftTab === 'orders' ? (
              <OrderBook
                stops={stops}
                onAddStop={handleAddStop}
                onDeleteStop={handleDeleteStop}
                onLoadPreset={handleLoadPreset}
                selectedStopId={selectedStopId}
                onSelectStop={setSelectedStopId}
                onClearAllStops={handleClearAllStops}
              />
            ) : (
              <FleetManager
                vehicles={vehicles}
                onAddVehicle={handleAddVehicle}
                onUpdateVehicle={handleUpdateVehicle}
                onDeleteVehicle={handleDeleteVehicle}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={setSelectedVehicleId}
              />
            )}
          </div>
        </section>

        {/* Center Column (Map visual rendering space) */}
        <section className="flex-1 h-full min-w-[450px]">
          <InteractiveMap
            stops={stops}
            vehicles={vehicles}
            depot={depot}
            trafficZones={trafficZones}
            simulationTime={simulationTime}
            isSimulationRunning={isSimulating}
            onAddStop={handleMapClickAdd}
            onUpdateStopCoordinates={handleUpdateStopCoords}
            selectedStopId={selectedStopId}
            onSelectStop={setSelectedStopId}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
          />
        </section>

        {/* Right Column (Analytics & AI Copilot tabs) */}
        <section className="w-1/4 min-w-[320px] max-w-[400px] flex flex-col gap-3 h-full">
          {/* Custom Tabs */}
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-200/60 shadow-xs">
            <button
              onClick={() => setRightTab('analytics')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                rightTab === 'analytics'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart className="w-3.5 h-3.5" /> Optimizer Controls
            </button>
            <button
              onClick={() => setRightTab('copilot')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                rightTab === 'copilot'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Copilot
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'analytics' ? (
              <AnalyticsPanel
                vehicles={vehicles}
                stops={stops}
                config={config}
                onUpdateConfig={setConfig}
                onOptimize={triggerOptimization}
              />
            ) : (
              <AICopilot stops={stops} vehicles={vehicles} config={config} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
