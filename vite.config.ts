import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: '/NeatFleet/',
    plugins: [react(), tailwindcss()],
    // All app env vars (VITE_SUPABASE_URL, VITE_MAP_TILE_URL, VITE_ORS_API_KEY,
    // etc.) use the VITE_ prefix, so Vite injects them into import.meta.env
    // automatically — no explicit `define` block needed.
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
