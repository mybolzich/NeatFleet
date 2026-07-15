import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing — add to .env.local');
}

if (url && !/^https?:\/\//i.test(url)) {
  throw new Error(
    `[NeatFleet] VITE_SUPABASE_URL is invalid: "${url}"\n` +
    `It must be your Supabase project URL, e.g. https://xxxx.supabase.co\n` +
    `Not the PostgreSQL connection string. Fix the GitHub secret and redeploy.`
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
