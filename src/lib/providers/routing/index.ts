import type { RoutingProvider } from '../types';
import { openRouteServiceRouting } from './openRouteService';
import { osrmRouting } from './osrm';

// VITE_ROUTING_PROVIDER selects the backend without touching app code.
// 'ors' (default) — OpenRouteService hosted Directions API.
// 'osrm' — a self-hosted/managed OSRM instance (VITE_OSRM_BASE_URL).
const provider = ((import.meta.env.VITE_ROUTING_PROVIDER as string) || 'ors').toLowerCase();

export function getRoutingProvider(): RoutingProvider {
  if (provider === 'osrm') return osrmRouting;
  return openRouteServiceRouting;
}
