import { defineConfig } from 'vite';

const backend = 'http://localhost:4000';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  appType: 'spa',
  optimizeDeps: {
    include: ['jspdf'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '^/(health|ots|clients|vehicles|expenses|clientes|tiendas|mantenciones|flota)(/|$)': {
        target: backend,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: false,
    proxy: {
      '^/(health|ots|clients|vehicles|expenses|clientes|tiendas|mantenciones|flota)(/|$)': {
        target: backend,
        changeOrigin: true,
      },
    },
  },
});
