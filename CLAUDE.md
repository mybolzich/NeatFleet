# NeatFleet — Developer Guide (CLAUDE.md)

> Read this before making any changes. All implementation work happens on the `launch-mvp` branch. Never push directly to `main`.

---

## Project Overview

NeatFleet is a fleet routing and dispatch platform with two portals:

- **Dispatcher Portal** — Create orders, manage fleet, build routes, dispatch
- **Driver Portal** — View assigned routes, mark stops Arrived / Completed / Skipped / Failed

**Current state:** The UI shell exists (React + Vite + TypeScript + Tailwind). Authentication and fleet/order CRUD work. All data persists in `localStorage` — this must be migrated to Supabase PostgreSQL before the pilot.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS 4 |
| Backend | Node.js + Express (`server.ts`) |
| Database | Supabase PostgreSQL ← **to be implemented** |
| Auth | Supabase Auth ← **replace Firebase/Appwrite** |
| Authorization | Supabase Row Level Security (RLS) |
| Maps | Google Maps Platform (`@vis.gl/react-google-maps`) |
| AI | Google Gemini 3.5 Flash (`/api/ai-analyze`) |
| Deployment | Vercel (target) |

---

## Local Setup

```bash
# 1. Clone and switch to the working branch
git clone https://github.com/mybolzich/NeatFleet.git
cd NeatFleet
git checkout launch-mvp

# 2. Install dependencies
npm install

# 3. Create .env.local (never commit this file)
cp .env.example .env.local
# Fill in real values — see Environment Variables section below

# 4. Start dev server
npm run dev
# Opens at http://localhost:5173
```

---

## Environment Variables

### Browser-safe (`.env.local`, `VITE_` prefix)

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key from Supabase > Settings > API>
VITE_GOOGLE_MAPS_API_KEY=<your Google Maps API key>
```

### Server-only (Vercel secrets — never in `.env.local` or code)

```bash
GEMINI_API_KEY=<Google Gemini API key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret from Supabase > Settings > API>
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It must NEVER be used in the browser bundle. Only use it in `server.ts` for privileged server-side operations.

---

## Database Schema

Eight tables, all with `company_id` for tenant isolation:

```
companies          — tenants (each company = one account)
profiles           — users (owner / dispatcher / driver)
vehicles           — fleet (capacity, shift, cost, color)
orders             — deliveries (address, time window, priority, volume)
routes             — dispatch plans (vehicle + service date)
route_stops        — order assignments in a route (sequence, ETA, status)
dispatch_events    — audit trail (route created/dispatched, stop arrived/completed)
audit_logs         — system activity (INSERT/UPDATE/DELETE records)
```

Full SQL schema: see `SCHEMA.sql` in the repo root (to be added in Milestone 1).

---

## Row Level Security (RLS) — Key Rules

| Role | Companies | Vehicles/Orders | Routes | Route Stops | Audit |
|------|-----------|-----------------|--------|-------------|-------|
| **owner** | Read/Update own | Full CRUD | Full CRUD | Full CRUD | Read |
| **dispatcher** | Read own | Full CRUD | Full CRUD | Full CRUD | None |
| **driver** | None | Read only | Read only | **Update status only** | None |

**Critical:** Every table has a `company_id` column. RLS policies enforce it — users can NEVER read or write another company's records, even with a valid JWT.

Drivers can only set `route_stops.status` to: `Arrived`, `Completed`, `Skipped`, or `Failed`. They cannot modify stop sequence, route assignment, or order details.

---

## Roles

```typescript
type UserRole = 'owner' | 'dispatcher' | 'driver';
```

- **owner** — Company admin. Full access to all data + audit logs. Set at registration.
- **dispatcher** — Manages fleet, orders, routes, and dispatch. Cannot view audit logs.
- **driver** — Mobile-only. Sees only assigned routes. Marks stops. No CRUD.

---

## Source Structure

```
src/
├── App.tsx                    # App shell + role-based routing
├── types.ts                   # Shared TypeScript types
├── lib/
│   ├── supabase.ts            # ← CREATE: Supabase client
│   ├── auth/
│   │   ├── useAuth.ts         # ← CREATE: Supabase Auth hook
│   │   └── useProfile.ts      # ← CREATE: Profile + company hydration
│   └── hooks/
│       ├── useVehicles.ts     # ← CREATE: CRUD + Supabase Realtime
│       ├── useOrders.ts       # ← CREATE
│       ├── useRoutes.ts       # ← CREATE
│       └── useRouteStops.ts   # ← CREATE (driver status updates)
├── components/
│   ├── AuthScreen.tsx         # ← REPLACE Firebase with Supabase Auth
│   ├── FleetManager.tsx       # ← WIRE to useVehicles()
│   ├── OrderBook.tsx          # ← WIRE to useOrders()
│   ├── InteractiveMap.tsx     # ← WIRE to useRoutes() + Realtime
│   ├── AICopilot.tsx          # Keep — add JWT auth check
│   ├── AnalyticsPanel.tsx     # Keep — wire to Supabase data
│   └── Driver/                # ← CREATE entire folder
│       ├── DriverLayout.tsx
│       ├── AssignedRoutes.tsx
│       ├── RouteDetail.tsx
│       └── StopStatusForm.tsx
└── utils/
    └── optimizer.ts           # Keep — VRP solver (nearest-neighbor)
```

---

## What Is Already Working

- ✅ Firebase Email/Password Auth (login, register, logout, session persistence)
- ✅ Fleet Management UI (Add/Edit/Delete vehicles)
- ✅ Order Book UI (Add/Edit/Delete orders, CSV export)
- ✅ Google Maps (Tampa center, geocoding via Places Autocomplete, stop pins)
- ✅ Route Optimizer (nearest-neighbor VRP with time windows + traffic zones)
- ✅ AI Dispatch Copilot (Gemini 3.5 Flash analysis via `/api/ai-analyze`)

## What Is NOT Working (Must Be Built)

- ❌ Data does not persist across devices (localStorage only)
- ❌ No Row Level Security — any user can see any company's data
- ❌ No driver portal
- ❌ No real-time updates between dispatcher and driver
- ❌ No audit trail
- ❌ Not deployed to production

---

## Milestone Plan

| # | Milestone | Est. Hours |
|---|-----------|-----------|
| 0 | Foundation — Supabase + Vercel accounts, env vars, dev server | 2h |
| 1 | Supabase Auth — replace Firebase, profile hydration | 4h |
| 2 | RLS + Supabase CRUD for vehicles + orders | 5h |
| 3 | Routes + route stops + Supabase Realtime | 6h |
| 4 | Full dispatcher portal CRUD (all tabs wired to Supabase) | 8h |
| 5 | Driver portal (mobile-first, assigned routes, stop status) | 10h |
| 6 | Dispatch events + audit trail | 4h |
| 7 | End-to-end testing + bug fixes | 6h |
| 8 | Vercel deployment + environment secrets | 4h |
| 9 | Documentation + handoff | 3h |
| | **Total** | **~52 hours** |

---

## Git Workflow

```bash
# All work goes on launch-mvp, never main
git checkout launch-mvp

# Create a feature branch from launch-mvp
git checkout -b feature/supabase-auth

# Make changes, then commit
git add .
git commit -m "feat: replace Firebase auth with Supabase"

# Push and open PR → merge into launch-mvp
git push origin feature/supabase-auth
```

**Branch rules:**
- `main` — protected, no direct pushes
- `launch-mvp` — working branch for all MVP development
- `feature/*` — individual features, branched from and merged into `launch-mvp`

---

## API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/api/health` | No | Server health check |
| POST | `/api/ai-analyze` | Yes (JWT) | Gemini route analysis |

The `/api/ai-analyze` endpoint must verify the Supabase JWT before calling Gemini. Without this check, anyone can call it and incur API costs.

---

## Security Rules

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser bundle** — it bypasses all RLS
2. **Never commit `.env.local`** — already in `.gitignore`
3. **Never push secrets to `main`** — Vercel injects them at build time from its dashboard
4. **Always use `company_id` in queries** — even with RLS, explicit filtering is safer
5. **Restrict Google Maps API key to your domain** — prevents quota theft

---

## Debugging

| Problem | Where to Look |
|---------|--------------|
| Auth not working | Supabase Dashboard → Authentication → Users |
| Data missing | Supabase Dashboard → Table Editor → check RLS policies |
| RLS blocking data | Supabase → SQL Editor → run query as authenticated user |
| Maps not loading | Browser DevTools → Console → check API key errors |
| Gemini not responding | Network tab → `/api/ai-analyze` → check response body |
| Build failing | Vercel dashboard → Deployments → click failed deploy → Build Logs |

---

## Known Limitations (Post-Pilot Backlog)

- No GPS real-time tracking
- No photo / proof-of-delivery capture
- No SMS or push notifications to drivers
- No customer-facing tracking portal
- Route optimizer uses nearest-neighbor heuristic (not a commercial TSP solver)
- No native mobile app (web-only via browser)

---

## Accounts Required (Owner Must Create)

| Service | Purpose | URL |
|---------|---------|-----|
| Supabase | Database, Auth, Realtime | https://supabase.com |
| Google Cloud | Maps + Places API keys | https://console.cloud.google.com |
| Google AI Studio | Gemini API key | https://aistudio.google.com/app/apikey |
| Vercel | Hosting + environment secrets | https://vercel.com |

See `OWNER_ACTIONS.md` for step-by-step instructions on creating each account and copying values into `.env.local` and Vercel.
