import { Client, Account, Databases, ID, Query } from 'appwrite';

// ── Public config (safe to expose — no secret keys here) ────────────
export const APPWRITE_ENDPOINT = 'https://sfo.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = '6a4d84c700060a436df9';
export const DB_ID = 'neatfleet_db';

export const COLLECTIONS = {
  companies: 'companies',
  users: 'users',
  vehicles: 'vehicles',
  stops: 'stops',
  depots: 'depots',
  trafficZones: 'traffic_zones',
  routes: 'routes',
} as const;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export { client, ID, Query };
