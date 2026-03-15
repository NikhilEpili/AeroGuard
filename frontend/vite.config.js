import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: 'localhost'
  },
  // MapLibre GL JS v4+ uses native class fields.
  // Without esnext target, esbuild transpiles them to __publicField() calls.
  // When the maplibre chunk is split, the helper may be missing → runtime crash.
  // Targeting esnext keeps class fields native and eliminates __publicField entirely.
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext',
    // Silence the 500 kB warning; MapLibre GL JS is a full WebGL renderer
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Split vendor libs into separate cacheable chunks
        manualChunks: {
          maplibre: ['maplibre-gl'],
          react:    ['react', 'react-dom'],
          axios:    ['axios']
        }
      }
    }
  }
})
