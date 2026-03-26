/**
 * Ejecución operativa local — tareas visibles, responsable asignado, marca obligatoria.
 * No ejecuta APIs externas: persiste cola para UI y seguimiento humano.
 */

import { appendMemoryEvent } from './jarvis-memory.js';

export const JARVIS_ACTION_ENGINE_VERSION = '2026-03-24';

const LS_TASKS = 'hnf_jarvis_operational_tasks_v1';
const MAX_TASKS = 36;

const readJson = (key, fb) => {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fb;
  } catch {
    return fb;
  }
};

const writeJson = (key, v) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export function getJarvisOperationalTasks() {
  const arr = readJson(LS_TASKS, []);
  return Array.isArray(arr) ? arr : [];
}

export function dismissJarvisOperationalTask(id) {
  const idStr = String(id || '');
  const next = getJarvisOperationalTasks().filter((t) => t.id !== idStr);
  writeJson(LS_TASKS, next);
  return next;
}

/**
 * @param {ReturnType<typeof import('./jarvis-alien-intelligence.js').buildAlienDecisionCore>} decisionCore
 * @param {object} [opts]
 * @param {string} [opts.source] - 'evolution' | 'ingesta' | 'pulse_evolution'
 */
export function executeJarvisActions(decisionCore, opts = {}) {
  const dc = decisionCore || {};
  const source = opts.source || 'alien_core';
  const prev = getJarvisOperationalTasks();
  const at = new Date().toISOString();
  const estadoGlobal = dc.estadoGlobal || 'estable';

  /** @type {object[]} */
  const added = [];
  for (const t of dc.top3Acciones || []) {
    const accion = String(t.accion || '').trim();
    if (!accion) continue;
    const dup = prev.some((p) => p.accion === accion && (Date.now() - new Date(p.at).getTime()) < 3_600_000);
    if (dup) continue;
    added.push({
      id: `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at,
      source,
      obligatoria: true,
      accion,
      responsable: String(t.responsable || 'Operación').trim(),
      impactoDinero: Math.round(Number(t.impactoDinero) || 0),
      urgencia: String(t.urgencia || 'media'),
      estadoGlobal,
      focoDelDia: dc.focoDelDia || null,
    });
  }

  const merged = [...added, ...prev].slice(0, MAX_TASKS);
  writeJson(LS_TASKS, merged);
  if (added.length) {
    appendMemoryEvent('operational_tasks', { source, n: added.length, estadoGlobal });
  }
  return { added: added.length, tasks: merged };
}

/**
 * Ingesta → decisión → acción (una o dos tareas inmediatas).
 * @param {object} classification - salida classifyIntakePayload / proceso imagen
 * @param {object} [meta]
 */
export function executeIntakeThroughActionPipeline(classification, meta = {}) {
  const c = classification || {};
  const urg = String(c.urgencia || 'media');
  const estadoGlobal =
    c.generaRiesgo || urg === 'alta' || urg === 'critica' ? 'tension' : c.generaOportunidad ? 'estable' : 'tension';
  const accion = String(c.accionInmediata || c.accionRecomendada || 'Clasificar en OT u oportunidad y asignar dueño con hora.').trim();
  const core = {
    version: JARVIS_ACTION_ENGINE_VERSION,
    computedAt: new Date().toISOString(),
    estadoGlobal,
    focoDelDia: accion,
    top3Acciones: [
      {
        accion,
        responsable: String(c.responsable || 'Operación'),
        impactoDinero: Math.round(Number(c.impactoEconomicoEstimado || c.ingresoPotencial || 0) || 0),
        urgencia: urg,
      },
    ],
    advertencias: c.generaRiesgo ? [String(c.narrativaRiesgo || 'Riesgo operativo asociado a la ingesta.')] : [],
    oportunidades: c.generaOportunidad
      ? [{ texto: String(c.narrativaOportunidad || 'Oportunidad vinculada a la ingesta.'), id: meta.archivo || null }]
      : [],
    siNoActua: 'Si no registrás el siguiente paso con dueño, la señal se pierde y el dinero queda fuera de control.',
  };
  return executeJarvisActions(core, { source: 'ingesta', ...meta });
}
