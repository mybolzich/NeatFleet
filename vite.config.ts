import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: '/NeatFleet/',
    plugins: [react(), tailwindcss()],
    define: {
      // Injected at build time from GitHub Actions secrets / .env.local
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    // VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are automatically
    // injected by Vite from env vars — no need to list them here.
    // Access in code via: import.meta.env.VITE_SUPABASE_URL
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
