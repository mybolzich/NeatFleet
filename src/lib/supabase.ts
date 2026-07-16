import { createClient } from '@supabase/supabase-js';

const rawUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const rawAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Validate that the URL is an HTTPS Supabase endpoint (not a connection string)
const isValidUrl = typeof rawUrl === 'string' && rawUrl.startsWith('https://');

const url  = isValidUrl ? rawUrl  : 'https://placeholder.supabase.co';
const anon = rawAnon ?? 'placeholder-anon-key';

if (!isValidUrl || !rawAnon) {
  console.warn(
    '[Supabase] Missing or invalid env vars. ' +
    'Set VITE_SUPABASE_URL (https://...) and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const backendConfigured = isValidUrl && !!rawAnon;
