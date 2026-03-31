import { mapOtToLane } from './ot-kanban-lanes.js';

/**
 * Señales agregadas para presencia Jarvis en panel gerencial (solo datos de OT reales).
 */

function normEstado(e) {
  return String(e ?? '')
    .trim()
    .toLowerCase();
}

/** @param {object[]} list */
export function countOtsConRiesgoJarvis(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((o) => Boolean(o?.riesgoDetectado)).length;
}

/** @param {object[]} list */
export function countOtsUrgentes(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((o) => {
    const p = String(o?.prioridadOperativa ?? o?.prioridadSugerida ?? '')
      .trim()
      .toLowerCase();
    return p === 'alta';
  }).length;
}

/** @param {object[]} list */
export function countOtsPendienteAprobacion(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((o) => mapOtToLane(o) === 'pendiente_aprobacion').length;
}

/**
 * OT con mayor peso operativo para el copiloto (riesgo → urgencia → cola Lyn → orden estable).
 * @param {object[]} list
 */
export function pickJarvisFocoOt(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const scored = list.map((o, i) => {
    let s = 0;
    if (Boolean(o?.riesgoDetectado)) s += 100;
    const p = String(o?.prioridadOperativa ?? o?.prioridadSugerida ?? '')
      .trim()
      .toLowerCase();
    if (p === 'alta') s += 50;
    const lyn = String(o?.aprobacionLynEstado ?? '')
      .trim()
      .toLowerCase();
    if (lyn === 'pendiente_revision_lyn') s += 30;
    const e = normEstado(o?.estado);
    if (!['cerrada', 'finalizada', 'facturada'].includes(e)) s += 1;
    return { o, s, i };
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored[0].o;
}

/**
 * Texto de sugerencia principal derivado solo de conteos (sin inventar OT).
 * @param {{ nTotal: number, nRiesgo: number, nUrgentes: number, nPendAprobacion: number }} s
 */
export function mainSuggestionFromSignals(s) {
  const n = s?.nTotal ?? 0;
  if (n === 0) return 'sin dato';
  const r = s.nRiesgo ?? 0;
  const u = s.nUrgentes ?? 0;
  const p = s.nPendAprobacion ?? 0;
  if (r > 0) return `Priorizar revisión de ${r} OT con riesgo detectado`;
  if (u > 0) return `Atender ${u} OT en prioridad alta`;
  if (p > 0) return `Gestionar ${p} OT pendientes de aprobación`;
  return 'Sin señales prioritarias en la muestra actual';
}

/**
 * @param {object[]} list
 */
export function buildJarvisGerencialSignals(list) {
  const arr = Array.isArray(list) ? list : [];
  const nTotal = arr.length;
  const nRiesgo = countOtsConRiesgoJarvis(arr);
  const nUrgentes = countOtsUrgentes(arr);
  const nPendAprobacion = countOtsPendienteAprobacion(arr);
  return {
    nTotal,
    nRiesgo,
    nUrgentes,
    nPendAprobacion,
    focoOt: pickJarvisFocoOt(arr),
    suggestion: mainSuggestionFromSignals({ nTotal, nRiesgo, nUrgentes, nPendAprobacion }),
  };
}
