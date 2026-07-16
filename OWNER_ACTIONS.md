# NeatFleet — Owner Actions Required

All steps below are manual actions only you can complete (account creation, API keys, secrets). No code editing required.

---

## Step 1 — Create Supabase Project

1. Go to https://supabase.com → click **Start your project**
2. Sign in with GitHub, Google, or email
3. Click **New Project** → fill in:
   - **Project Name:** `NeatFleet`
   - **Database Password:** create a strong password and save it somewhere safe
   - **Region:** `East US` (closest to Florida)
4. Click **Create new project** — wait 2–3 minutes
5. When ready, go to **Settings → API** in the left sidebar
6. Copy these values:
   - **Project URL** → this is your `VITE_SUPABASE_URL`
   - **anon / public** key → this is your `VITE_SUPABASE_ANON_KEY`
   - **service_role / secret** key → save it separately — do NOT share it or put it in code

---

## Step 2 — Create Map Tile + Routing/Geocoding Accounts

NeatFleet uses no Google Maps Platform APIs. Maps are OpenStreetMap-based
(Leaflet), and directions/geocoding run through OpenRouteService — both have
free tiers.

**Map tiles (pick one):**
1. Go to https://www.maptiler.com/cloud/ (or https://stadiamaps.com/) → sign up free
2. Create a map/key and copy the raster tile URL template, e.g.
   `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=YOUR_KEY`
3. This is your `VITE_MAP_TILE_URL`. Copy the attribution text your provider
   requires (usually shown on the same page) — this is your
   `VITE_MAP_TILE_ATTRIBUTION`.

**Routing + address search:**
1. Go to https://openrouteservice.org/dev/#/signup → sign up free
2. Create a token — this is your `VITE_ORS_API_KEY`
3. *(Recommended)* In the ORS dashboard, restrict the key to your domains
   (`localhost:5173`, your Vercel URL)

---

## Step 3 — Create Google Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key**
3. Copy the key — this is your `GEMINI_API_KEY`

---

## Step 4 — Create Vercel Account and Link the Repository

1. Go to https://vercel.com → click **Sign Up**
2. Sign in with GitHub (recommended)
3. On the Vercel dashboard, click **Add New… → Project**
4. Find `mybolzich/NeatFleet` in the list → click **Import**
5. Set **Framework Preset** to **Other** (Vite will be auto-detected)
6. Under **Environment Variables**, add each of the following:

   | Variable Name | Value |
   |---------------|-------|
   | `VITE_SUPABASE_URL` | from Step 1 |
   | `VITE_SUPABASE_ANON_KEY` | from Step 1 |
   | `VITE_MAP_TILE_URL` | from Step 2 |
   | `VITE_MAP_TILE_ATTRIBUTION` | from Step 2 |
   | `VITE_ORS_API_KEY` | from Step 2 |
   | `GEMINI_API_KEY` | from Step 3 |

7. Click **Deploy** — Vercel builds and gives you a live URL (e.g., `https://neatfleet.vercel.app`)
8. Vercel auto-detects `requirements.txt` and `api/optimize.py` and deploys the
   OR-Tools solver as a Python serverless function — no extra setup needed.
   If it's ever unreachable, the app automatically falls back to an in-browser
   route-planning heuristic, so Build Routes always works either way.

---

## Step 5 — Run the Database Schema

1. Open your Supabase project → click **SQL Editor** in the left sidebar
2. Click **+ New Query**
3. Open `SCHEMA.sql` in this repository and copy the entire contents
4. Paste into the SQL Editor → click **Run**
5. You should see a green success message
6. Go to **Table Editor** — confirm you see 8 tables: `companies`, `profiles`, `vehicles`, `orders`, `routes`, `route_stops`, `dispatch_events`, `audit_logs`

---

## Step 6 — Enable Row Level Security

1. In Supabase → SQL Editor → **+ New Query**
2. Open `RLS_POLICIES.sql` in this repository and copy the entire contents
3. Paste → click **Run**
4. Go to **Authentication → Policies** to confirm policies appear on each table

---

## Step 7 — Test the Live Site

1. Open your Vercel URL (e.g., `https://neatfleet.vercel.app`)
2. Click **Register**, fill in your details and company name
3. You should land on the dispatcher dashboard
4. Create a vehicle, add an order, check the map

If anything looks broken, open the browser DevTools (F12) → **Console** tab and take a screenshot to share with your developer.

---

## Summary of Values to Keep Safe

| Value | Where to Store |
|-------|---------------|
| Supabase Database Password | Password manager |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel secrets only — never in code |
| `GEMINI_API_KEY` | Vercel secrets only |
| `VITE_SUPABASE_ANON_KEY` | Vercel env vars + `.env.local` (safe, public) |
| `VITE_ORS_API_KEY` | Vercel env vars + `.env.local` (restrict to your domains) |
| `VITE_MAP_TILE_URL` | Vercel env vars + `.env.local` (often contains your tile provider key) |
