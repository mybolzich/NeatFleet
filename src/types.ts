export type Priority = 'Low' | 'Medium' | 'High';

export type StopStatus = 'Pending' | 'In Transit' | 'Completed' | 'Delayed';

export interface Stop {
  id: string;
  name: string;
  customer: string;
  x: number; // 0 to 100 representing position on coordinate system
  y: number; // 0 to 100
  address: string;
  volume: number; // units consumed from truck capacity (e.g., cubic meters, boxes)
  timeWindowStart: number; // minutes from 08:00 AM (e.g., 0 = 8:00 AM, 120 = 10:00 AM)
  timeWindowEnd: number; // minutes from 08:00 AM (e.g., 480 = 4:00 PM)
  serviceDuration: number; // minutes spent at stop
  priority: Priority;
  status: StopStatus;
  assignedVehicleId: string | null;
  stopSequence: number | null; // 0-indexed sequence of visit
  eta: number | null; // predicted arrival time (minutes from 08:00 AM)
  arrivalTime: number | null; // actual arrival time during simulation
}

export type VehicleStatus = 'Idle' | 'Active' | 'Returning' | 'Off Shift';

export interface VehicleMetrics {
  totalDistance: number;
  totalTime: number; // includes driving and service duration
  loadUsed: number;
  delayCount: number;
  totalCost: number;
}

export interface Vehicle {
  id: string;
  name: string;
  capacity: number; // max load units
  shiftStart: number; // minutes from 08:00 AM (e.g., 0)
  shiftEnd: number; // minutes from 08:00 AM (e.g., 480 = 4:00 PM)
  costPerMile: number; // cost per coordinate unit
  costPerHour: number; // cost per hour of operations
  color: string; // Hex color code for path drawing
  speed: number; // coordinate units per minute (e.g., 1.5 units/min)
  status: VehicleStatus;
  metrics: VehicleMetrics;
}

export interface Depot {
  x: number;
  y: number;
  address: string;
}

export interface TrafficZone {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number; // radius of influence
  delayFactor: number; // travel duration multiplier (e.g., 2.0 = double travel time)
}

export interface OptimizerConfig {
  minimizeVehicles: boolean;
  timeWindowWeight: number; // penalty weight for window violations
  capacityWeight: number; // penalty weight for overloads
  trafficAware: boolean;
}

export interface SimulationState {
  isRunning: boolean;
  speedMultiplier: number; // how many simulated minutes per real-time second
  currentTime: number; // minutes from 08:00 AM
}
