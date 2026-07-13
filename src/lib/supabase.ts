/**
 * Supabase client — reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * from build-time env vars (injected by GitHub Actions / .env.local).
 *
 * The anon key is safe to include in the browser bundle.
 * The service_role key must NEVER be used here — server-side only.
 *
 * Usage:  import { supabase } from '../lib/supabase'
 */

// Supabase JS v2 is not installed yet — install with:
//   npm install @supabase/supabase-js
// This file is a placeholder ready for Milestone 1.

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Warn clearly in dev if env vars are missing
if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n' +
    'Add them to .env.local for local dev, or to GitHub Actions secrets for deployment.'
  );
}

// TODO (Milestone 1): uncomment once @supabase/supabase-js is installed
// import { createClient } from '@supabase/supabase-js';
// export const supabase = createClient(supabaseUrl, supabaseAnon);

// Placeholder export until Milestone 1
export const supabaseConfig = { url: supabaseUrl, anonKey: supabaseAnon };
