-- ── NeatFleet Database Schema ───────────────────────────────────────────
-- Run this once in Supabase Dashboard → SQL Editor → New Query → Run
-- Project: upcbqiopipkskqskbhcq

-- ── 1. Companies (tenants) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  dispatch_address TEXT NOT NULL DEFAULT '',
  dispatch_lat     FLOAT NOT NULL DEFAULT 28.1518,
  dispatch_lng     FLOAT NOT NULL DEFAULT -82.3743,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Profiles (linked to auth.users) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'dispatcher'
              CHECK (role IN ('owner', 'dispatcher', 'driver')),
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Vehicles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  capacity      FLOAT NOT NULL DEFAULT 100,
  shift_start   INT NOT NULL DEFAULT 0,
  shift_end     INT NOT NULL DEFAULT 480,
  cost_per_mile FLOAT NOT NULL DEFAULT 1.2,
  cost_per_hour FLOAT NOT NULL DEFAULT 15,
  color         TEXT NOT NULL DEFAULT '#38bdf8',
  speed         FLOAT NOT NULL DEFAULT 1.5,
  status        TEXT DEFAULT 'Idle'
                CHECK (status IN ('Idle','Active','Returning','Off Shift')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Orders ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  customer           TEXT NOT NULL,
  address            TEXT NOT NULL DEFAULT '',
  lat                FLOAT,
  lng                FLOAT,
  x                  FLOAT DEFAULT 50,
  y                  FLOAT DEFAULT 50,
  volume             FLOAT NOT NULL DEFAULT 10,
  time_window_start  INT NOT NULL DEFAULT 0,
  time_window_end    INT NOT NULL DEFAULT 480,
  service_duration   INT NOT NULL DEFAULT 20,
  priority           TEXT NOT NULL DEFAULT 'Medium'
                     CHECK (priority IN ('Low','Medium','High')),
  status             TEXT DEFAULT 'Pending'
                     CHECK (status IN ('Pending','In Transit','Completed','Delayed','Skipped','Failed')),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Routes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT DEFAULT 'Planned'
               CHECK (status IN ('Planned','Active','Completed','Cancelled')),
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, vehicle_id, service_date)
);

-- ── 6. Route Stops ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_stops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  route_id      UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stop_sequence INT NOT NULL DEFAULT 0,
  eta           INT,
  arrival_time  INT,
  status        TEXT DEFAULT 'Pending'
                CHECK (status IN ('Pending','Arrived','Completed','Skipped','Failed')),
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 7. Dispatch Events (audit trail) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  route_id   UUID REFERENCES routes(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  stop_id    UUID REFERENCES route_stops(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
             CHECK (event_type IN (
               'route_created','route_dispatched','route_completed',
               'stop_arrived','stop_completed','stop_skipped','stop_failed',
               'vehicle_status_changed'
             )),
  actor_id   UUID NOT NULL REFERENCES profiles(id),
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_company  ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company  ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company    ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_routes_company    ON routes(company_id);
CREATE INDEX IF NOT EXISTS idx_routes_date       ON routes(service_date);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);

-- ── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_events ENABLE ROW LEVEL SECURITY;

-- Helper: get the company_id of the current user
CREATE OR REPLACE FUNCTION my_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get the role of the current user
CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ── Companies policies ────────────────────────────────────────────────────
CREATE POLICY "users see own company"   ON companies FOR SELECT USING (id = my_company_id());
CREATE POLICY "owners update company"   ON companies FOR UPDATE USING (id = my_company_id() AND my_role() = 'owner');
CREATE POLICY "anyone insert company"   ON companies FOR INSERT WITH CHECK (true);

-- ── Profiles policies ─────────────────────────────────────────────────────
CREATE POLICY "users see company profiles"  ON profiles FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "users insert own profile"    ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "owners manage profiles"      ON profiles FOR UPDATE USING (company_id = my_company_id() AND my_role() = 'owner');

-- ── Vehicles policies ─────────────────────────────────────────────────────
CREATE POLICY "company sees vehicles"       ON vehicles FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "dispatcher inserts vehicle"  ON vehicles FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));
CREATE POLICY "dispatcher updates vehicle"  ON vehicles FOR UPDATE USING (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));
CREATE POLICY "dispatcher deletes vehicle"  ON vehicles FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));

-- ── Orders policies ───────────────────────────────────────────────────────
CREATE POLICY "company sees orders"         ON orders FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "dispatcher inserts order"    ON orders FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));
CREATE POLICY "dispatcher updates order"    ON orders FOR UPDATE USING (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));
CREATE POLICY "dispatcher deletes order"    ON orders FOR DELETE USING (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));

-- ── Routes policies ───────────────────────────────────────────────────────
CREATE POLICY "company sees routes"         ON routes FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "dispatcher inserts route"    ON routes FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));
CREATE POLICY "dispatcher updates route"    ON routes FOR UPDATE USING (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));

-- ── Route Stops policies ──────────────────────────────────────────────────
CREATE POLICY "company sees stops"          ON route_stops FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "dispatcher manages stops"    ON route_stops FOR INSERT WITH CHECK (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));
CREATE POLICY "dispatcher updates stops"    ON route_stops FOR UPDATE USING (company_id = my_company_id() AND my_role() IN ('owner','dispatcher'));
CREATE POLICY "driver updates stop status"  ON route_stops FOR UPDATE
  USING (company_id = my_company_id() AND my_role() = 'driver')
  WITH CHECK (status IN ('Arrived','Completed','Skipped','Failed'));

-- ── Dispatch Events policies ──────────────────────────────────────────────
CREATE POLICY "company sees events"         ON dispatch_events FOR SELECT USING (company_id = my_company_id());
CREATE POLICY "company inserts events"      ON dispatch_events FOR INSERT WITH CHECK (company_id = my_company_id());

