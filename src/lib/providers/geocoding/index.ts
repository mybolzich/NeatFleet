import type { GeocodingProvider } from '../types';
import { openRouteServiceGeocoding } from './openRouteService';

// Only one geocoding backend today (ORS/Pelias). The indirection exists so a
// future Nominatim/Photon or Google Places implementation can be dropped in
// via VITE_GEOCODING_PROVIDER without touching OrderBook.tsx.
export function getGeocodingProvider(): GeocodingProvider {
  return openRouteServiceGeocoding;
}
