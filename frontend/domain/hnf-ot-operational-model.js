/**
 * Modelo operativo mínimo de OT (flujo HNF) — sin backend obligatorio.
 */

/** @typedef {'clima'|'flota'} OtTipoServicioFlow */

/** Estados del flujo operativo (columnas Kanban / motor). */
export const OT_ESTADO_FLUJO = [
  'ingreso',
  'en_proceso',
  'observado',
  'aprobado',
  'enviado',
  'cerrado',
];

/** @param {unknown} x */
export function isEstadoFlujo(x) {
  return OT_ESTADO_FLUJO.includes(String(x || '').toLowerCase());
}

/**
 * @param {object} raw
 * @returns {boolean}
 */
export function isHnfLocalFlowOt(raw) {
  return Boolean(raw && typeof raw === 'object' && raw.hnfFlowLocal === true);
}
