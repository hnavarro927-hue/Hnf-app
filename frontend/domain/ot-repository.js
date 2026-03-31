/**
 * Capa de persistencia operativa OT — hoy localStorage; sustituible por API.
 */

import { normalizeOT } from './hnf-ot-normalize.js';
import {
  createOtFromIntakeFlow,
  loadFlowStore,
  mergePlanOtsWithFlow,
  persistEstadoOperativo,
  saveFlowStore,
} from './hnf-ot-flow-storage.js';

/**
 * Fuente única de OT para Kanban y KPIs (API + parches + locales), todas normalizadas.
 * @param {object[]} planOtsRaw — típicamente `data.ots.data` o equivalente
 */
export function getAllOTs(planOtsRaw) {
  const merged = mergePlanOtsWithFlow(Array.isArray(planOtsRaw) ? planOtsRaw : []);
  return merged.map((o) => normalizeOT(o)).filter(Boolean);
}

/**
 * @param {object} ot — debe incluir id coherente
 */
export function saveOT(ot) {
  const n = normalizeOT(ot);
  if (!n) return { ok: false, error: 'normalize_failed' };
  const store = loadFlowStore();
  const id = String(n.id);
  const rest = (store.localOts || []).filter((x) => String(x?.id) !== id);
  store.localOts = [...rest, n];
  saveFlowStore(store);
  return { ok: true, ot: n };
}

/**
 * @param {string|number} id
 * @param {object} patch
 */
export function updateOT(id, patch) {
  const sid = String(id);
  const store = loadFlowStore();
  const idx = (store.localOts || []).findIndex((x) => String(x?.id) === sid);
  if (idx >= 0) {
    const merged = normalizeOT({ ...store.localOts[idx], ...patch, id: sid });
    if (!merged) return { ok: false, error: 'normalize_failed' };
    store.localOts[idx] = merged;
    saveFlowStore(store);
    return { ok: true, ot: merged };
  }
  if (patch && (patch.estadoOperativo != null || patch.estado_operativo != null)) {
    const st = String(patch.estadoOperativo ?? patch.estado_operativo).toLowerCase();
    store.estadoById = { ...store.estadoById, [sid]: st };
    saveFlowStore(store);
    return { ok: true };
  }
  return { ok: false, error: 'not_found' };
}

/** Transición validada + historial (delega en flow-storage). */
export const updateEstado = persistEstadoOperativo;

export { createOtFromIntakeFlow, mergePlanOtsWithFlow, persistEstadoOperativo };
