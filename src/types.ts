export type Priority = 'Low' | 'Medium' | 'High';

export type StopStatus = 'Pending' | 'In Transit' | 'Completed' | 'Delayed';

export interface Stop {
  id: string;
  name: string;
  customer: string;
  x: number; // abstract 0-100 grid (used by VRP optimizer)
  y: number; // abstract 0-100 grid
  lat?: number; // real-world latitude from geocoding
  lng?: number; // real-world longitude from geocoding
  address: string;
  volume: number;
  timeWindowStart: number; // minutes from 08:00 AM
  timeWindowEnd: number;
  serviceDuration: number;
  priority: Priority;
  status: StopStatus;
  assignedVehicleId: string | null;
  stopSequence: number | null;
  eta: number | null;
  arrivalTime: number | null;
}

export type VehicleStatus = 'Idle' | 'Active' | 'Returning' | 'Off Shift';

export interface VehicleMetrics {
  totalDistance: number;
  totalTime: number;
  loadUsed: number;
  delayCount: number;
  totalCost: number;
}

export interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  shiftStart: number;
  shiftEnd: number;
  costPerMile: number;
  costPerHour: number;
  color: string;
  speed: number;
  status: VehicleStatus;
  metrics: VehicleMetrics;
}

export interface Depot {
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  address: string;
}

export interface TrafficZone {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  delayFactor: number;
}

export interface OptimizerConfig {
  minimizeVehicles: boolean;
  timeWindowWeight: number;
  capacityWeight: number;
  trafficAware: boolean;
}

export interface SimulationState {
  isRunning: boolean;
  speedMultiplier: number;
  currentTime: number;
}
