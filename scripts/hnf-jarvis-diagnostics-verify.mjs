#!/usr/bin/env node
/**
 * Prueba mínima del motor JarvisSystemDiagnostics + runJarvisOperationalDecisionEngine (sin navegador).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { runJarvisSystemDiagnostics, resolveOtsListFromViewData } = await import(
  pathToFileURL(path.join(root, 'frontend/domain/jarvis-system-diagnostics.js')).href
);
const { runJarvisOperationalDecisionEngine } = await import(
  pathToFileURL(path.join(root, 'frontend/domain/jarvis-operational-decision-engine.js')).href
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1) Sin conexión → backend error
let d = runJarvisSystemDiagnostics({
  integrationStatus: 'sin conexión',
  viewData: { ots: { data: [] } },
});
assert(d.overall === 'error', 'sin conexión debe marcar overall error');
assert(d.checks.some((c) => c.id === 'backend' && c.status === 'error'), 'check backend error');

let e = runJarvisOperationalDecisionEngine({
  integrationStatus: 'sin conexión',
  viewData: { ots: { data: [{ id: '1', estado: 'nueva' }] } },
  focoOt: { id: '1', riesgoDetectado: false },
});
assert(e.reglasDisparadas.includes('backend_offline'), 'motor debe disparar backend_offline');
assert(/reiniciar|backend/i.test(e.accionRecomendada), 'acción debe mencionar backend');

// 2) Conectado + muestra vacía → warning en ots y decisión panel
d = runJarvisSystemDiagnostics({
  integrationStatus: 'conectado',
  viewData: { ots: { data: [] } },
});
assert(d.checks.find((c) => c.id === 'ots_read')?.status === 'warning', 'ots vacío → warning');

e = runJarvisOperationalDecisionEngine({
  integrationStatus: 'conectado',
  viewData: { ots: { data: [] } },
});
assert(e.reglasDisparadas.includes('panel_sin_datos'), 'lista vacía → panel_sin_datos');

// 3) OT abierta sin prioridad → warning/error según ratio
const manySinPri = Array.from({ length: 10 }, (_, i) => ({
  id: `x${i}`,
  estado: 'nueva',
  riesgoDetectado: false,
}));
d = runJarvisSystemDiagnostics({
  integrationStatus: 'conectado',
  viewData: { ots: { data: manySinPri } },
});
assert(
  d.checks.find((c) => c.id === 'prioridad_operativa')?.status === 'error',
  'muchas sin prioridad → error'
);

// 4) resolveOtsList
const list = resolveOtsListFromViewData({ planOts: [{ id: 'p', estado: 'cerrada' }] });
assert(list.length === 1 && list[0].id === 'p', 'planOts debe resolverse');

// 5) Riesgo foco
e = runJarvisOperationalDecisionEngine({
  integrationStatus: 'conectado',
  viewData: {
    ots: {
      data: [
        {
          id: 'r1',
          estado: 'en_proceso',
          prioridadOperativa: 'media',
          riesgoDetectado: true,
          tecnicoAsignado: 'Romina',
          montoCobrado: 100,
          utilidad: 10,
        },
      ],
    },
  },
  focoOt: {
    id: 'r1',
    estado: 'en_proceso',
    prioridadOperativa: 'media',
    riesgoDetectado: true,
    tecnicoAsignado: 'Romina',
    montoCobrado: 100,
    utilidad: 10,
  },
});
assert(e.reglasDisparadas.includes('riesgo_foco'), 'riesgo en foco → escalar');

console.log('[hnf-jarvis-diagnostics-verify] OK — motor de diagnóstico y decisiones coherente.');
