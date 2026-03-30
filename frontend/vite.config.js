import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:4000';

  return {
    root: '.',
    publicDir: 'public',
    appType: 'spa',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    optimizeDeps: {
      include: ['jspdf'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      proxy: {
        '^/auth(/|$)': { target: backend, changeOrigin: true },
        '^/(health|api|ots|clients|vehicles|expenses|clientes|tiendas|mantenciones|operational-calendar|technical-documents|commercial-opportunities|flota|outlook|whatsapp|historical-vault|jarvis-operative-events)(/|$)':
          {
            target: backend,
            changeOrigin: true,
          },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: false,
      proxy: {
        '^/auth(/|$)': { target: backend, changeOrigin: true },
        '^/(health|api|ots|clients|vehicles|expenses|clientes|tiendas|mantenciones|operational-calendar|technical-documents|commercial-opportunities|flota|outlook|whatsapp|historical-vault|jarvis-operative-events)(/|$)':
          {
            target: backend,
            changeOrigin: true,
          },
      },
    },
  };
});
