-- ============================================================
-- NeatFleet — Supabase Schema (Milestone 2)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Helper functions ──────────────────────────────────────────────────────

-- Returns the company_id for the currently authenticated user.
-- Used in RLS policies across all tables.
CREATE OR REPLACE FUNCTION my_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$;

-- Returns the role for the currently authenticated user.
CREATE OR REPLACE FUNCTION my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ── companies ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id               uuid PRIMARY KEY,
  name             text NOT NULL,
  slug             text NOT NULL,
  dispatch_lat     float8 NOT NULL DEFAULT 0,
  dispatch_lng     float8 NOT NULL DEFAULT 0,
  dispatch_address text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may create a company (needed at registration time,
-- before the profile row exists).
CREATE POLICY "companies_insert"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users may only read their own company.
CREATE POLICY "companies_select"
  ON companies FOR SELECT
  TO authenticated
  USING (id = my_company_id());

-- Only owners may update their company.
CREATE POLICY "companies_update"
  ON companies FOR UPDATE
  TO authenticated
  USING (id = my_company_id() AND my_role() = 'owner')
  WITH CHECK (id = my_company_id());

-- ── profiles ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'owner'
                   CHECK (role IN ('owner', 'dispatcher', 'driver')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- A user can only insert their own profile row.
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can read profiles within their company.
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (company_id = my_company_id());

-- A user can update their own profile; owners can update any profile in their company.
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR my_role() = 'owner')
  WITH CHECK (company_id = my_company_id());

-- ── vehicles ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies ON DELETE CASCADE,
  name           text NOT NULL,
  capacity       int4 NOT NULL DEFAULT 100,
  shift_start    int4 NOT NULL DEFAULT 0,
  shift_end      int4 NOT NULL DEFAULT 480,
  cost_per_mile  float8 NOT NULL DEFAULT 1.5,
  cost_per_hour  float8 NOT NULL DEFAULT 18.0,
  color          text NOT NULL DEFAULT '#38bdf8',
  speed          float8 NOT NULL DEFAULT 1.5,
  status         text NOT NULL DEFAULT 'Idle'
                      CHECK (status IN ('Idle', 'Active', 'Returning', 'Off Shift')),
  metrics        jsonb NOT NULL DEFAULT '{
    "totalDistance": 0,
    "totalTime": 0,
    "loadUsed": 0,
    "delayCount": 0,
    "totalCost": 0
  }'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_all"
  ON vehicles FOR ALL
  TO authenticated
  USING (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id());

CREATE INDEX IF NOT EXISTS vehicles_company_id_idx ON vehicles (company_id);

-- ── stops (orders) ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stops (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies ON DELETE CASCADE,
  name                text NOT NULL,
  customer            text NOT NULL DEFAULT '',
  x                   float8 NOT NULL DEFAULT 50,
  y                   float8 NOT NULL DEFAULT 50,
  lat                 float8,
  lng                 float8,
  address             text NOT NULL DEFAULT '',
  volume              int4 NOT NULL DEFAULT 10,
  time_window_start   int4 NOT NULL DEFAULT 0,
  time_window_end     int4 NOT NULL DEFAULT 480,
  service_duration    int4 NOT NULL DEFAULT 20,
  priority            text NOT NULL DEFAULT 'Medium'
                           CHECK (priority IN ('Low', 'Medium', 'High')),
  status              text NOT NULL DEFAULT 'Pending'
                           CHECK (status IN ('Pending', 'In Transit', 'Completed', 'Delayed')),
  assigned_vehicle_id uuid REFERENCES vehicles ON DELETE SET NULL,
  stop_sequence       int4,
  eta                 int4,
  arrival_time        int4,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stops_all"
  ON stops FOR ALL
  TO authenticated
  USING (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id());

CREATE INDEX IF NOT EXISTS stops_company_id_idx ON stops (company_id);
CREATE INDEX IF NOT EXISTS stops_assigned_vehicle_id_idx ON stops (assigned_vehicle_id);

-- ── route_plans ───────────────────────────────────────────────────────────
-- One row per vehicle per service date; tracks build → dispatch lifecycle.
-- Lets the dispatcher UI survive page refreshes and syncs to driver devices.

CREATE TABLE IF NOT EXISTS route_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies ON DELETE CASCADE,
  vehicle_id    uuid NOT NULL REFERENCES vehicles  ON DELETE CASCADE,
  service_date  date NOT NULL,
  status        text NOT NULL DEFAULT 'built'
                     CHECK (status IN ('built', 'dispatched', 'active', 'completed')),
  stop_count    int4 NOT NULL DEFAULT 0,
  dispatched_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, vehicle_id, service_date)
);

ALTER TABLE route_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_plans_all"
  ON route_plans FOR ALL
  TO authenticated
  USING (company_id = my_company_id())
  WITH CHECK (company_id = my_company_id());

CREATE INDEX IF NOT EXISTS route_plans_company_date_idx
  ON route_plans (company_id, service_date);
