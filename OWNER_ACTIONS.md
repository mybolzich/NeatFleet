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

## Step 2 — Create Google Maps API Key

1. Go to https://console.cloud.google.com
2. At the top, click the project dropdown → **New Project**
   - Name: `NeatFleet` → click **Create**
3. Wait for the project to activate, then go to **APIs & Services → Library**
4. Search **Maps JavaScript API** → click it → click **Enable**
5. Search **Places API** → click it → click **Enable**
6. Go to **APIs & Services → Credentials**
7. Click **Create Credentials → API Key** — copy the key
8. *(Recommended)* Click the new key to open it:
   - Under **Application restrictions**, select **HTTP referrers (websites)**
   - Add: `localhost:5173/*` and your Vercel URL (e.g., `neatfleet.vercel.app/*`)
   - Click **Save**

The key you copied is your `VITE_GOOGLE_MAPS_API_KEY`.

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
   | `VITE_GOOGLE_MAPS_API_KEY` | from Step 2 |
   | `GEMINI_API_KEY` | from Step 3 |

7. Click **Deploy** — Vercel builds and gives you a live URL (e.g., `https://neatfleet.vercel.app`)

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
| `VITE_GOOGLE_MAPS_API_KEY` | Vercel env vars + `.env.local` (restrict to your domains) |
