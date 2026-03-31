import { applyJarvisRulesToNewOt } from './hnf-ot-jarvis-rules.js';
import { normalizeOT } from './hnf-ot-normalize.js';
import { canTransitionEstado, getEffectiveEstadoOperativo } from './hnf-ot-state-engine.js';

const STORAGE_KEY = 'hnf.ot.flow.v1';

/**
 * @typedef {{ localOts: object[], estadoById: Record<string, string>, seq: number }} HnfOtFlowStore
 */

/** @returns {HnfOtFlowStore} */
export function loadFlowStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { localOts: [], estadoById: {}, seq: 0 };
    const p = JSON.parse(raw);
    return {
      localOts: Array.isArray(p.localOts) ? p.localOts : [],
      estadoById: p.estadoById && typeof p.estadoById === 'object' ? p.estadoById : {},
      seq: typeof p.seq === 'number' ? p.seq : 0,
    };
  } catch {
    return { localOts: [], estadoById: {}, seq: 0 };
  }
}

/** @param {HnfOtFlowStore} store */
export function saveFlowStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

/**
 * Superpone estado operativo persistido y agrega OT locales creadas en ingesta.
 * @param {object[]} planOts
 */
export function mergePlanOtsWithFlow(planOts) {
  const store = loadFlowStore();
  const base = Array.isArray(planOts) ? planOts.map((o) => ({ ...o })) : [];
  const byId = new Map(base.map((o) => [String(o.id), o]));

  for (const [id, st] of Object.entries(store.estadoById)) {
    const o = byId.get(String(id));
    if (o && typeof st === 'string') o.estadoOperativo = st;
  }

  for (const lo of store.localOts) {
    if (!lo || typeof lo !== 'object') continue;
    const id = String(lo.id);
    if (!byId.has(id)) {
      base.push({ ...lo });
      byId.set(id, base[base.length - 1]);
    }
  }
  return base;
}

/**
 * @param {{ descripcion?: string, cliente?: string, text?: string, area?: string|null }} ctx
 * @returns {object}
 */
export function createOtFromIntakeFlow(ctx) {
  const store = loadFlowStore();
  store.seq = (store.seq || 0) + 1;
  const id = `L-${Date.now()}-${store.seq}`;
  const now = new Date().toISOString();
  const jarvis = applyJarvisRulesToNewOt({
    text: ctx.text || ctx.descripcion || '',
    area: ctx.area,
    cliente: ctx.cliente,
  });

  const ot = {
    id,
    cliente: String(ctx.cliente || 'Sin cliente').trim() || 'Sin cliente',
    tipoServicio: jarvis.tipoServicio,
    descripcion: String(ctx.descripcion || ctx.text || '—').trim().slice(0, 2000),
    estado: 'nueva',
    estadoOperativo: 'ingreso',
    prioridadOperativa: jarvis.prioridadOperativa,
    prioridadSugerida: jarvis.prioridadOperativa,
    tecnicoAsignado: jarvis.responsable,
    responsableActual: jarvis.responsable,
    fecha_creacion: now,
    fecha_actualizacion: now,
    hnfFlowLocal: true,
    historial: [
      {
        at: now,
        accion: 'jarvis_alta_flujo',
        detalle: `OT desde ingesta · Jarvis → tipo ${jarvis.tipoServicio}, P ${jarvis.prioridadOperativa}, ${jarvis.responsable}`,
      },
    ],
  };

  const normalized = normalizeOT(ot) || ot;
  store.localOts = [...(store.localOts || []), normalized];
  saveFlowStore(store);
  return normalized;
}

/**
 * @param {object} ot — OT ya mergeada (API + parches locales)
 * @param {string} nuevoEstado
 * @returns {{ ok: boolean, error?: string }}
 */
export function persistEstadoOperativo(ot, nuevoEstado) {
  const to = String(nuevoEstado || '').toLowerCase();
  if (!ot || ot.id == null) return { ok: false, error: 'ot_invalida' };
  const id = String(ot.id);
  const from = getEffectiveEstadoOperativo(ot);
  if (!canTransitionEstado(from, to)) {
    return { ok: false, error: `Transición no válida: ${from} → ${to}` };
  }

  const store = loadFlowStore();
  const localIdx = (store.localOts || []).findIndex((x) => String(x?.id) === id);

  if (localIdx >= 0) {
    const lo = store.localOts[localIdx];
    const now = new Date().toISOString();
    const next = {
      ...lo,
      estadoOperativo: to,
      estado_operativo: to,
      fecha_actualizacion: now,
      historial: [
        ...(Array.isArray(lo.historial) ? lo.historial : []),
        { at: now, accion: 'estado_flujo', detalle: `${from} → ${to}` },
      ],
    };
    store.localOts[localIdx] = normalizeOT(next) || next;
    saveFlowStore(store);
    return { ok: true };
  }

  store.estadoById = { ...store.estadoById, [id]: to };
  saveFlowStore(store);
  return { ok: true };
}

/**
 * @param {string|number} otId
 */
export function deleteLocalFlowOt(otId) {
  const store = loadFlowStore();
  const id = String(otId);
  store.localOts = (store.localOts || []).filter((x) => String(x?.id) !== id);
  const { [id]: _, ...rest } = store.estadoById || {};
  store.estadoById = rest;
  saveFlowStore(store);
}
