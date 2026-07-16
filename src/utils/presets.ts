import { Stop, Priority } from '../types';

export type PresetKey = 'downtown' | 'suburban' | 'windows' | 'heavy-cargo';

type PresetStop = Omit<Stop, 'id' | 'status' | 'assignedVehicleId' | 'stopSequence' | 'eta' | 'arrivalTime'>;

function stop(
  name: string, customer: string, x: number, y: number,
  volume: number, timeWindowStart: number, timeWindowEnd: number,
  serviceDuration: number, priority: Priority
): PresetStop {
  return {
    name, customer, x, y,
    address: 'Demo address — no real geocoding',
    volume, timeWindowStart, timeWindowEnd, serviceDuration, priority,
  };
}

// Tight cluster near the depot, narrow windows — simulates dense urban
// delivery during rush hour where every stop is minutes apart.
function downtownRushHour(): PresetStop[] {
  return [
    stop('5th Ave Deli', 'Marco\'s Kitchen', 46, 44, 8, 0, 60, 10, 'High'),
    stop('Union Tower Lobby', 'Union Tower LLC', 54, 48, 12, 0, 90, 15, 'High'),
    stop('Riverside Cafe', 'Riverside Group', 50, 56, 10, 30, 90, 10, 'Medium'),
    stop('Metro Plaza Suite 400', 'Metro Plaza Retail', 58, 50, 15, 30, 120, 15, 'High'),
    stop('Courthouse Sq Kiosk', 'City Courthouse', 44, 52, 6, 0, 60, 5, 'Medium'),
    stop('Harbor View Offices', 'Harbor View Corp', 52, 42, 9, 60, 120, 10, 'Medium'),
    stop('Old Mill Bakery', 'Old Mill Co', 48, 58, 11, 30, 90, 15, 'High'),
    stop('Transit Center Dock', 'City Transit Authority', 56, 56, 14, 60, 150, 20, 'Medium'),
  ];
}

// Wide spread, large orders, generous windows — simulates enterprise
// clients spaced far apart across a suburban service area.
function suburbanEnterprise(): PresetStop[] {
  return [
    stop('Westfield Distribution Hub', 'Westfield Retail', 15, 20, 60, 0, 300, 30, 'Medium'),
    stop('Northgate Business Park', 'Northgate Holdings', 20, 80, 55, 0, 360, 25, 'Low'),
    stop('Lakeside Corporate Campus', 'Lakeside Enterprises', 85, 25, 70, 60, 360, 35, 'Medium'),
    stop('Cedar Ridge Warehouse', 'Cedar Ridge Logistics', 80, 78, 65, 30, 300, 30, 'Low'),
    stop('Sunrise Industrial Park', 'Sunrise Manufacturing', 10, 50, 50, 60, 360, 25, 'Medium'),
    stop('Greenfield Office Complex', 'Greenfield Partners', 90, 50, 45, 0, 240, 20, 'Low'),
    stop('Pinehill Retail Center', 'Pinehill Group', 35, 90, 58, 90, 360, 30, 'Medium'),
  ];
}

// Narrow, overlapping delivery windows scattered across the grid — stress
// tests the optimizer's ability to satisfy tight, conflicting time slots.
function timeWindowSqueeze(): PresetStop[] {
  return [
    stop('Precision Clinic', 'Precision Health', 30, 30, 12, 15, 45, 15, 'High'),
    stop('Ironclad Legal', 'Ironclad LLP', 70, 35, 8, 20, 50, 10, 'High'),
    stop('Bloom Florist', 'Bloom & Co', 45, 60, 6, 30, 55, 10, 'High'),
    stop('Summit Bank Branch', 'Summit Financial', 55, 25, 10, 10, 40, 15, 'High'),
    stop('Vertex Labs', 'Vertex Diagnostics', 25, 70, 9, 45, 75, 20, 'Medium'),
    stop('North Pharmacy', 'North Pharmacy Group', 65, 65, 7, 60, 90, 10, 'High'),
    stop('Coastal Dental', 'Coastal Dental Care', 40, 45, 8, 25, 55, 15, 'Medium'),
    stop('Anchor Insurance', 'Anchor Mutual', 60, 50, 11, 50, 80, 15, 'Medium'),
  ];
}

// Large per-stop volumes that push toward vehicle capacity — simulates a
// peak day where load balancing across the fleet actually matters.
function heavyCargoPeak(): PresetStop[] {
  return [
    stop('BuildRight Supply Yard', 'BuildRight Materials', 20, 40, 90, 0, 240, 40, 'High'),
    stop('Anchor Freight Dock', 'Anchor Freight Co', 75, 30, 85, 0, 240, 35, 'High'),
    stop('Coastal Produce Depot', 'Coastal Produce', 40, 75, 80, 30, 180, 30, 'High'),
    stop('Statewide Beverage Co', 'Statewide Beverage', 60, 70, 95, 0, 210, 40, 'Medium'),
    stop('Granite Hardware Wholesale', 'Granite Hardware', 30, 60, 88, 30, 240, 35, 'Medium'),
    stop('Harborfront Cold Storage', 'Harborfront Logistics', 80, 55, 92, 0, 180, 40, 'High'),
  ];
}

export function generatePreset(key: PresetKey): PresetStop[] {
  switch (key) {
    case 'downtown': return downtownRushHour();
    case 'suburban': return suburbanEnterprise();
    case 'windows': return timeWindowSqueeze();
    case 'heavy-cargo': return heavyCargoPeak();
  }
}
