/**
 * Espera a que API /health y Vite respondan (tercer proceso de concurrently).
 * No mantiene el proceso vivo: al validar imprime y sale; api+vite siguen arriba.
 */
import process from 'node:process';

const backendPort = Number(process.env.BACKEND_PORT || process.env.PORT || 4000);
const frontendPort = Number(process.env.HNF_DEV_FRONTEND_PORT || 5173);
const healthUrl = `http://127.0.0.1:${backendPort}/health`;
const viteUrl = `http://127.0.0.1:${frontendPort}/`;

const TIMEOUT_MS = 120_000;
const INTERVAL_MS = 400;

async function ok(url) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  const start = Date.now();
  for (;;) {
    const h = await ok(healthUrl);
    const v = await ok(viteUrl);
    if (h && v) {
      console.log('');
      console.log('[HNF] Validación OK: API (/health) y Vite responden.');
      console.log(`      ${healthUrl}`);
      console.log(`      ${viteUrl}`);
      console.log('');
      process.exit(0);
    }
    if (Date.now() - start > TIMEOUT_MS) {
      console.error('[HNF] Timeout esperando API o Vite. Revisá los logs de api y vite.');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();
