import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// MoorMove's web app on :5174 (E-MOORM's is on :5173); /api goes to
// MoorMove's own backend on :4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
