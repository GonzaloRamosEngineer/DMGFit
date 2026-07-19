import { defineConfig } from 'vitest/config';

// Tests de lógica pura (sin DOM). TZ fija para que los tests de fecha
// sean deterministas (reproducen el escenario "Salta UTC-3" del bug de timezone).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx,mjs}'],
    env: {
      TZ: 'America/Argentina/Buenos_Aires',
      // Dummy: evita que supabaseClient tire "supabaseUrl is required" al importarse
      // en tests que tocan servicios (no se hace ninguna llamada real).
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
