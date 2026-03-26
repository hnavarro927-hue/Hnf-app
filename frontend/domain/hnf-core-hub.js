/**
 * HNF CORE — solicitudes unificadas: filtros por rol, progreso y columnas Kanban.
 */

import { resolveOperatorRole } from './hnf-operator-role.js';

export const HNF_CORE_ESTADO_COLUMNS = [
  'recibido',
  'en_proceso',
  'pendiente_aprobacion',
  'observado',
  'aprobado',
  'enviado',
  'cerrado',
];

export const HNF_CORE_CHECKLIST_KEYS = [
  'ingreso',
  'diagnostico',
  'ejecucion',
  'informe',
  'aprobacion',
  'envio',
];

const ESTADO_LABEL = {
  recibido: 'RECIBIDO',
  en_proceso: 'EN PROCESO',
  pendiente_aprobacion: 'PEND. APROB.',
  observado: 'OBSERVADO',
  aprobado: 'APROBADO',
  enviado: 'ENVIADO',
  cerrado: 'CERRADO',
};

export function labelEstadoSolicitud(estado) {
  return ESTADO_LABEL[estado] || String(estado || '').toUpperCase();
}

/**
 * @param {object} s
 * @returns {number} 0–100
 */
export function solicitudProgressPct(s) {
  const c = s?.checklist && typeof s.checklist === 'object' ? s.checklist : {};
  const done = HNF_CORE_CHECKLIST_KEYS.filter((k) => c[k]).length;
  return Math.round((done / Math.max(1, HNF_CORE_CHECKLIST_KEYS.length)) * 100);
}

/**
 * @param {object[]} list
 */
export function computeHnfCoreSolicitudStats(list) {
  const items = Array.isArray(list) ? list : [];
  const activas = items.filter((s) => s.estado && s.estado !== 'cerrado').length;
  const pendienteAprobacion = items.filter((s) => s.estado === 'pendiente_aprobacion').length;
  const observados = items.filter((s) => s.estado === 'observado').length;
  const enRiesgo = items.filter(
    (s) => s.prioridad === 'critica' || s.estado === 'observado' || s.prioridad === 'alta'
  ).length;
  return {
    total: items.length,
    activas,
    pendienteAprobacion,
    observados,
    enRiesgo,
    lineaNucleo: `${activas} ACT. · ${pendienteAprobacion} APROB. · ${enRiesgo} RIESGO`,
  };
}

/**
 * Filtra lista según rol operativo (panel por usuario).
 * @param {object[]} list
 * @param {string} [role]
 */
export function filterSolicitudesForRole(list, role) {
  const r = role || resolveOperatorRole();
  const items = Array.isArray(list) ? list : [];
  if (r === 'admin') return items;
  if (r === 'clima') return items.filter((s) => s.tipo === 'clima');
  if (r === 'flota') return items.filter((s) => s.tipo === 'flota' || s.tipo === 'comercial');
  if (r === 'control') {
    return items.filter((s) => s.estado === 'pendiente_aprobacion' || s.estado === 'observado');
  }
  return items;
}

/**
 * Siguiente estado sugerido (botón rápido).
 * @param {object} s
 */
export function nextEstadoSugerido(s) {
  const e = s?.estado;
  const map = {
    recibido: 'en_proceso',
    en_proceso: 'pendiente_aprobacion',
    pendiente_aprobacion: 'aprobado',
    observado: 'en_proceso',
    aprobado: 'enviado',
    enviado: null,
    cerrado: null,
  };
  return map[e] || null;
}

export function demoraAlertaSolicitud(s, nowMs = Date.now()) {
  const t = new Date(s?.updatedAt || s?.fecha || 0).getTime();
  if (!Number.isFinite(t)) return null;
  const h = (nowMs - t) / 3600000;
  if (h >= 72) return { nivel: 'critico', horas: Math.floor(h) };
  if (h >= 24) return { nivel: 'alerta', horas: Math.floor(h) };
  return null;
}
