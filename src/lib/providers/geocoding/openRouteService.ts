import type { GeocodingProvider, GeocodeSuggestion } from '../types';

const BASE_URL = (import.meta.env.VITE_ORS_BASE_URL as string) || 'https://api.openrouteservice.org';
const API_KEY = (import.meta.env.VITE_ORS_API_KEY as string) || '';

interface OrsFeature {
  properties: { label: string };
  geometry: { coordinates: [number, number] }; // [lng, lat]
}

interface OrsFeatureCollection {
  features: OrsFeature[];
}

function toSuggestion(feature: OrsFeature): GeocodeSuggestion {
  const [lng, lat] = feature.geometry.coordinates;
  return { label: feature.properties.label, lat, lng };
}

async function searchOrs(endpoint: 'autocomplete' | 'search', text: string, size: number): Promise<GeocodeSuggestion[]> {
  if (!API_KEY || !text.trim()) return [];

  const url = `${BASE_URL}/geocode/${endpoint}?api_key=${encodeURIComponent(API_KEY)}&text=${encodeURIComponent(text)}&size=${size}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as OrsFeatureCollection;
  return (data.features || []).map(toSuggestion);
}

// OpenRouteService's hosted Geocoding API (Pelias-backed). Free-tier API key
// required — see https://openrouteservice.org/dev/#/signup. Restrict the key
// by HTTP referrer in the ORS dashboard before shipping to production.
export const openRouteServiceGeocoding: GeocodingProvider = {
  async autocomplete(query: string): Promise<GeocodeSuggestion[]> {
    return searchOrs('autocomplete', query, 5);
  },

  async geocode(address: string): Promise<GeocodeSuggestion | null> {
    const results = await searchOrs('search', address, 1);
    return results[0] ?? null;
  },
};
