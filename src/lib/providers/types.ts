// ── Shared provider contracts ───────────────────────────────────────────────
// Every mapping/routing/optimization backend (OpenStreetMap+MapLibre/Leaflet,
// OpenRouteService, OSRM, OR-Tools, or a future Google Maps Platform
// implementation) speaks these interfaces. App code only imports from this
// file — never a concrete provider — so swapping a backend never requires
// touching a component.

export interface LatLng {
  lat: number;
  lng: number;
}

// ── Geocoding ────────────────────────────────────────────────────────────

export interface GeocodeSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export interface GeocodingProvider {
  /** Live-typing address suggestions (autocomplete-as-you-type). */
  autocomplete(query: string): Promise<GeocodeSuggestion[]>;
  /** One-shot address -> coordinates lookup (e.g. pasted address, no autocomplete pick). */
  geocode(address: string): Promise<GeocodeSuggestion | null>;
}

// ── Routing ──────────────────────────────────────────────────────────────

export interface RoutePath {
  /** Road-following polyline, depot -> stops in order -> depot. */
  path: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
}

export interface RoutingProvider {
  /** Ordered waypoints (first = last for a round trip); returns a road-snapped path. */
  route(waypoints: LatLng[]): Promise<RoutePath | null>;
}

// ── Optimization (VRP) ───────────────────────────────────────────────────
// Deliberately mirrors the shape of utils/optimizer.ts's optimizeRoutes()
// so the OR-Tools-backed provider is a drop-in replacement for the local
// heuristic — same inputs, same outputs, callers don't change.

export interface OptimizationProvider<TStop, TVehicle, TDepot, TTrafficZone, TConfig> {
  optimizeRoutes(
    stops: TStop[],
    vehicles: TVehicle[],
    depot: TDepot,
    trafficZones: TTrafficZone[],
    config: TConfig
  ): Promise<{ optimizedStops: TStop[]; optimizedVehicles: TVehicle[] }>;
}
