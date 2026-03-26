/**
 * HNF / Jarvis — orquestador local (Windows + Node).
 * Un solo proceso: lock, puertos, backend + frontend, health checks, reinicios, estado en UI.
 * Uso: npm run dev:jarvis (raíz del repo)
 */
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  watch as fsWatch,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const feRoot = path.join(root, 'frontend');
const beRoot = path.join(root, 'backend');
const lockPath = path.join(root, '.hnf-orchestrator.lock');
const statusPath = path.join(feRoot, 'public', 'hnf-auto-deploy-status.json');

const BACKEND_PORT_START = Number(process.env.HNF_BACKEND_PORT || process.env.BACKEND_PORT || 4000);
const FRONTEND_PORT_START = Number(process.env.HNF_FRONTEND_PORT || 5173);
const HEALTH_INTERVAL_MS = 8000;
const HEALTH_START_RETRIES = 60;
const HEALTH_START_DELAY_MS = 500;
const RESTART_BASE_MS = 2000;
const RESTART_MAX_MS = 30000;
const WATCH_DEBOUNCE_MS = 1600;
const MAX_CONSEC_RESTARTS = 8;

let lockOwned = false;
let backendPort = BACKEND_PORT_START;
let frontendPort = FRONTEND_PORT_START;
let beProc = null;
let feProc = null;
let beRestarts = 0;
let feRestarts = 0;
let lastRecoveredAt = 0;
let validateTimer = null;
let watchHandles = [];
let shuttingDown = false;

const nowIso = () => new Date().toISOString();

function writeStatus(payload) {
  const base = {
    updatedAt: nowIso(),
    backendPort,
    frontendPort,
    pid: process.pid,
    ...payload,
  };
  try {
    mkdirSync(path.dirname(statusPath), { recursive: true });
    writeFileSync(statusPath, `${JSON.stringify(base)}\n`, 'utf8');
  } catch (e) {
    console.error('[hnf-auto-deploy] No se pudo escribir estado:', e.message);
  }
}

function portFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.unref();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, host);
  });
}

async function pickPort(start, maxAttempts = 24) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const p = start + i;
    if (await portFree(p)) return p;
  }
  throw new Error(`No hay puerto libre desde ${start}`);
}

async function httpOk(url, timeoutMs = 4000) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

function readLock() {
  if (!existsSync(lockPath)) return null;
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!pid || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  const existing = readLock();
  if (existing?.pid && isProcessAlive(existing.pid)) {
    console.error(
      `[hnf-auto-deploy] Ya hay un orquestador activo (PID ${existing.pid}). Cerralo o borrá ${lockPath}.`
    );
    process.exit(1);
  }
  if (existsSync(lockPath)) {
    try {
      unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: nowIso() }, null, 2), 'utf8');
  lockOwned = true;
}

function releaseLock() {
  if (!lockOwned) return;
  try {
    const cur = readLock();
    if (cur?.pid === process.pid) unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
  lockOwned = false;
}

function spawnBackend() {
  beProc = spawn('npm', ['run', 'dev'], {
    cwd: beRoot,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(backendPort),
      BACKEND_PORT: String(backendPort),
      HNF_ORCHESTRATOR: '1',
    },
  });
  beProc.on('exit', (code, signal) => {
    beProc = null;
    console.log(`[hnf-auto-deploy] Backend salió (code=${code}, signal=${signal ?? '—'})`);
    if (!shuttingDown) scheduleRestart('backend', code, signal);
  });
}

function spawnFrontend() {
  feProc = spawn(
    'npm',
    ['run', 'dev', '--', '--port', String(frontendPort), '--strictPort'],
    {
      cwd: feRoot,
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
        HNF_ORCHESTRATOR: '1',
      },
    }
  );
  feProc.on('exit', (code, signal) => {
    feProc = null;
    console.log(`[hnf-auto-deploy] Frontend salió (code=${code}, signal=${signal ?? '—'})`);
    if (!shuttingDown) scheduleRestart('frontend', code, signal);
  });
}

let restartTimer = null;
function scheduleRestart(which, code, signal) {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void runRestartLoop(which, code, signal);
  }, 400);
}

async function runRestartLoop(which, code, signal) {
  if (which === 'backend') {
    beRestarts += 1;
    if (beRestarts > MAX_CONSEC_RESTARTS) {
      writeStatus({
        state: 'error',
        phase: 'backend',
        message: 'Backend: demasiados reinicios seguidos',
        lastError: { code, signal, at: nowIso() },
        diagnosis: 'Revisá logs arriba, puerto o base de datos. Tras corregir, Ctrl+C y volvé a ejecutar dev:jarvis.',
      });
      return;
    }
  } else {
    feRestarts += 1;
    if (feRestarts > MAX_CONSEC_RESTARTS) {
      writeStatus({
        state: 'error',
        phase: 'frontend',
        message: 'Frontend: demasiados reinicios seguidos',
        lastError: { code, signal, at: nowIso() },
        diagnosis: 'Revisá dependencias (npm install) y puerto Vite.',
      });
      return;
    }
  }

  const delay = Math.min(RESTART_BASE_MS * 2 ** Math.min(which === 'backend' ? beRestarts : feRestarts, 5), RESTART_MAX_MS);
  writeStatus({
    state: 'restarting',
    phase: which,
    message: `Reiniciando ${which === 'backend' ? 'API' : 'Vite'}…`,
    lastError: code != null || signal ? { code, signal, at: nowIso() } : undefined,
  });

  await new Promise((r) => setTimeout(r, delay));

  if (which === 'backend') {
    if (!beProc) spawnBackend();
    const ok = await waitForBackendHealth();
    if (ok) {
      beRestarts = 0;
      lastRecoveredAt = Date.now();
      writeStatus({
        state: 'recovered',
        message: 'Backend recuperado',
        recoveredAt: nowIso(),
      });
    }
  } else if (!feProc) {
    spawnFrontend();
    const viteUrl = `http://127.0.0.1:${frontendPort}/`;
    const ok = await waitForUrl(viteUrl, 40, 500);
    if (ok) {
      feRestarts = 0;
      lastRecoveredAt = Date.now();
      writeStatus({
        state: 'recovered',
        message: 'Frontend recuperado',
        recoveredAt: nowIso(),
      });
    }
  }

  if (lastRecoveredAt && Date.now() - lastRecoveredAt < 5000) {
    setTimeout(() => {
      writeStatus({
        state: 'active',
        message: 'Sistema activo',
        backendHealth: true,
        frontendHttp: true,
      });
    }, 1200);
  }
}

async function waitForBackendHealth() {
  const url = `http://127.0.0.1:${backendPort}/health`;
  for (let i = 0; i < HEALTH_START_RETRIES; i += 1) {
    if (await httpOk(url)) return true;
    await new Promise((r) => setTimeout(r, HEALTH_START_DELAY_MS));
  }
  return false;
}

async function waitForUrl(url, retries, delayMs) {
  for (let i = 0; i < retries; i += 1) {
    if (await httpOk(url)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function killTree(child) {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
        shell: true,
        stdio: 'ignore',
      });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    /* ignore */
  }
}

function shutdown() {
  shuttingDown = true;
  if (validateTimer) {
    clearInterval(validateTimer);
    validateTimer = null;
  }
  for (const w of watchHandles) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
  watchHandles = [];
  killTree(feProc);
  killTree(beProc);
  feProc = null;
  beProc = null;
  releaseLock();
  writeStatus({ state: 'stopped', message: 'Orquestador detenido', updatedAt: nowIso() });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function setupWatchers() {
  const beSrc = path.join(beRoot, 'src');
  if (!existsSync(beSrc)) return;

  const bump = debounce(() => {
    console.log('[hnf-auto-deploy] Cambios en backend/src → reinicio API');
    writeStatus({ state: 'restarting', phase: 'backend', message: 'Código backend cambió; reiniciando API…' });
    killTree(beProc);
    beProc = null;
    spawnBackend();
    void (async () => {
      const ok = await waitForBackendHealth();
      if (ok) {
        beRestarts = 0;
        lastRecoveredAt = Date.now();
        writeStatus({ state: 'recovered', message: 'API actualizada', recoveredAt: nowIso() });
        setTimeout(() => {
          writeStatus({
            state: 'active',
            message: 'Sistema activo',
            backendHealth: true,
            frontendHttp: true,
          });
        }, 1500);
      } else {
        writeStatus({
          state: 'error',
          phase: 'backend',
          message: 'Backend no respondió tras cambios',
          diagnosis: 'Revisá sintaxis o errores en consola del API.',
        });
      }
    })();
  }, WATCH_DEBOUNCE_MS);

  try {
    let w;
    try {
      w = fsWatch(beSrc, { recursive: true }, () => bump());
    } catch {
      w = fsWatch(beSrc, () => bump());
    }
    if (w) watchHandles.push(w);
  } catch (e) {
    console.warn('[hnf-auto-deploy] Watch backend omitido:', e.message);
  }
}

async function main() {
  if (!existsSync(path.join(feRoot, 'package.json')) || !existsSync(path.join(beRoot, 'package.json'))) {
    console.error('[hnf-auto-deploy] Ejecutá desde la raíz del repo (frontend/ y backend/).');
    process.exit(1);
  }

  acquireLock();

  try {
    backendPort = await pickPort(BACKEND_PORT_START);
    frontendPort = await pickPort(FRONTEND_PORT_START);
  } catch (e) {
    console.error('[hnf-auto-deploy]', e.message);
    releaseLock();
    process.exit(1);
  }

  console.log('');
  console.log('========================================');
  console.log('  HNF / Jarvis — ADN auto deploy local');
  console.log('========================================');
  console.log(`  API (objetivo):  http://127.0.0.1:${backendPort}`);
  console.log(`  Vite (objetivo): http://127.0.0.1:${frontendPort}`);
  console.log('  Estado UI:       /hnf-auto-deploy-status.json (public)');
  console.log('  Ctrl+C detiene orquestador y procesos hijos.');
  console.log('========================================');
  console.log('');

  writeStatus({
    state: 'starting',
    message: 'Iniciando backend…',
    backendHealth: false,
    frontendHttp: false,
  });

  spawnBackend();
  const beUp = await waitForBackendHealth();
  if (!beUp) {
    writeStatus({
      state: 'error',
      message: 'Backend no respondió en /health',
      diagnosis: 'Revisá backend (puerto, base de datos, logs).',
    });
    shutdown();
    process.exit(1);
  }

  beRestarts = 0;
  writeStatus({
    state: 'starting',
    message: 'Iniciando frontend…',
    backendHealth: true,
    frontendHttp: false,
  });

  spawnFrontend();
  const viteUrl = `http://127.0.0.1:${frontendPort}/`;
  const feUp = await waitForUrl(viteUrl, 50, 400);
  if (!feUp) {
    writeStatus({
      state: 'error',
      message: 'Vite no respondió',
      diagnosis: 'Revisá dependencias del frontend y el puerto.',
    });
    shutdown();
    process.exit(1);
  }

  feRestarts = 0;
  writeStatus({
    state: 'active',
    message: 'Sistema activo',
    backendHealth: true,
    frontendHttp: true,
  });

  setupWatchers();

  validateTimer = setInterval(async () => {
    if (shuttingDown) return;
    const healthUrl = `http://127.0.0.1:${backendPort}/health`;
    const h = await httpOk(healthUrl, 6000);
    const f = await httpOk(viteUrl, 6000);
    if (h && f) {
      beRestarts = 0;
      feRestarts = 0;
      writeStatus({
        state: 'active',
        message: 'Sistema activo',
        backendHealth: true,
        frontendHttp: true,
      });
      return;
    }
    writeStatus({
      state: 'error',
      message: !h ? 'API sin /health' : 'Vite no responde',
      backendHealth: h,
      frontendHttp: f,
      diagnosis: !h
        ? 'El proceso API puede haber caído; el orquestador intentará reiniciar si salió el hijo.'
        : 'Vite caído o puerto incorrecto.',
    });
  }, HEALTH_INTERVAL_MS);

  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[hnf-auto-deploy]', err);
  releaseLock();
  process.exit(1);
});
