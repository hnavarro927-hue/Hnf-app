#!/usr/bin/env node
/**
 * Smoke Jarvis: levanta backend aislado (OT en archivo temporal), POST /jarvis/intake (clima + flota),
 * verifica GET /ots. No toca backend/data/ots.json (usa HNF_OT_DATA_PATH temporal).
 */
import { spawn } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(repoRoot, 'backend');

const otPath = path.join(tmpdir(), `hnf-jarvis-verify-${process.pid}-${Date.now()}.json`);
writeFileSync(otPath, '[]\n', 'utf8');

const port = 44000 + Math.floor(Math.random() * 600);
const base = `http://127.0.0.1:${port}`;

const env = {
  ...process.env,
  BACKEND_PORT: String(port),
  HNF_AUTH_DISABLED: '1',
  HNF_OT_DATA_PATH: otPath,
};

const child = spawn(process.execPath, ['src/server.js'], {
  cwd: backendRoot,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr?.on('data', (c) => {
  stderr += String(c);
});

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error('Timeout esperando /health');
}

function shutdown() {
  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

let exitCode = 0;
try {
  await waitHealth();

  const rFlota = await fetch(`${base}/jarvis/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'email',
      texto: 'traslado vehiculo urgente verificacion jarvis',
      cliente: '__jarvis_smoke_flota__',
    }),
  });
  const jFlota = await rFlota.json();
  if (
    !rFlota.ok ||
    !jFlota.ok ||
    jFlota.ot?.tipoServicio !== 'flota' ||
    jFlota.ot?.tecnicoAsignado !== 'Gery' ||
    jFlota.ot?.prioridadSugerida !== 'alta' ||
    jFlota.ot?.prioridadOperativa !== 'alta' ||
    jFlota.ot?.riesgoDetectado !== true
  ) {
    console.error('[hnf-jarvis-verify] Falló rama flota', rFlota.status, jFlota);
    exitCode = 1;
  }

  if (exitCode === 0) {
    const rClima = await fetch(`${base}/jarvis/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'whatsapp',
        texto: 'mantencion aire acondicionado verificacion',
        cliente: '__jarvis_smoke_clima__',
        whatsappContactoNumero: '0000000000',
        whatsappContactoNombre: '__jarvis_smoke_clima__',
      }),
    });
    const jClima = await rClima.json();
    if (
      !rClima.ok ||
      !jClima.ok ||
      jClima.ot?.tipoServicio !== 'clima' ||
      jClima.ot?.tecnicoAsignado !== 'Romina' ||
      jClima.ot?.prioridadSugerida !== 'media' ||
      jClima.ot?.prioridadOperativa !== 'media' ||
      jClima.ot?.riesgoDetectado !== false
    ) {
      console.error('[hnf-jarvis-verify] Falló rama clima', rClima.status, jClima);
      exitCode = 1;
    }

    if (exitCode === 0) {
      const rList = await fetch(`${base}/ots`);
      const jList = await rList.json();
      const ids = (jList.data || []).map((o) => o.id);
      if (!ids.includes(jFlota.ot.id) || !ids.includes(jClima.ot.id)) {
        console.error('[hnf-jarvis-verify] OT no listadas en GET /ots', ids, jFlota.ot.id, jClima.ot.id);
        exitCode = 1;
      } else {
        console.log('[hnf-jarvis-verify] OK — flota', jFlota.ot.id, 'clima', jClima.ot.id);
      }
    }
  }
} catch (e) {
  console.error('[hnf-jarvis-verify]', e?.message || e, stderr.slice(-800));
  exitCode = 1;
} finally {
  shutdown();
  await sleep(400);
  try {
    unlinkSync(otPath);
  } catch {
    /* ignore */
  }
}

process.exit(exitCode);
