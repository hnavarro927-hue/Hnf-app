/**
 * JarvisDecisionEngine (operador técnico) — reglas sobre datos reales /ots + diagnóstico.
 * Distinto de buildJarvisDecisionEngine (mapa unificado / HQ).
 */

import { runJarvisSystemDiagnostics, resolveOtsListFromViewData } from './jarvis-system-diagnostics.js';

function normInt(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function sinResponsableAsignado(ot) {
  if (!ot || typeof ot !== 'object') return true;
  const t = String(ot.tecnicoAsignado ?? '').trim();
  const r = String(ot.responsableActual ?? '').trim();
  const bad = (x) => !x || normInt(x) === 'por asignar';
  return bad(t) && bad(r);
}

function prioridadAlta(ot) {
  const p = String(ot?.prioridadOperativa ?? ot?.prioridadSugerida ?? '')
    .trim()
    .toLowerCase();
  return p === 'alta';
}

/**
 * Sin margen útil o datos insuficientes para calcularlo.
 * @param {object} ot
 */
function margenCriticoOsinDato(ot) {
  if (!ot || typeof ot !== 'object') return true;
  const u = Number(ot.utilidad);
  const mc = Number(ot.montoCobrado);
  if (!Number.isFinite(u) || !Number.isFinite(mc)) return true;
  if (mc <= 0) return true;
  if (u <= 0) return true;
  return u / mc <= 0;
}

/**
 * @param {{
 *   integrationStatus?: string,
 *   viewData?: Record<string, unknown> | null,
 *   focoOt?: object | null,
 *   lastDataRefreshAt?: string | null,
 * }} ctx
 */
export function runJarvisOperationalDecisionEngine(ctx = {}) {
  const diagnostics = runJarvisSystemDiagnostics({
    integrationStatus: ctx.integrationStatus,
    viewData: ctx.viewData,
    lastDataRefreshAt: ctx.lastDataRefreshAt,
  });

  const integrationStatus = normInt(ctx.integrationStatus);
  const list = resolveOtsListFromViewData(ctx.viewData);
  const foco = ctx.focoOt && typeof ctx.focoOt === 'object' ? ctx.focoOt : null;

  /** @type {string[]} */
  const reglasDisparadas = [];
  let accionRecomendada = 'sin dato';
  let nivelRiesgo = 'bajo';
  let estadoGeneral = 'OK';

  if (integrationStatus === 'sin conexión' || integrationStatus === 'sin conexion') {
    reglasDisparadas.push('backend_offline');
    accionRecomendada =
      'Revisar servicio backend y API: host, puerto, red o reinicio controlado del servicio.';
    nivelRiesgo = 'alto';
    estadoGeneral = 'Crítico';
  } else if (integrationStatus === 'conectado' && list.length === 0) {
    reglasDisparadas.push('panel_sin_datos');
    accionRecomendada = 'Revisar conexión o API: la muestra de /ots llegó vacía.';
    nivelRiesgo = 'medio';
    estadoGeneral = 'Atención';
  } else if (foco?.riesgoDetectado === true) {
    reglasDisparadas.push('riesgo_foco');
    accionRecomendada =
      'Sugerir escalamiento operativo: riesgoDetectado en OT foco (revisión humana).';
    nivelRiesgo = 'alto';
    estadoGeneral = 'Atención';
  } else if (foco && prioridadAlta(foco) && sinResponsableAsignado(foco)) {
    reglasDisparadas.push('alta_sin_responsable');
    accionRecomendada = 'Asignar responsable (Romina/Gery o técnico) en la OT prioritaria.';
    nivelRiesgo = 'medio';
    estadoGeneral = 'Atención';
  } else if (foco && margenCriticoOsinDato(foco)) {
    reglasDisparadas.push('margen_costo');
    accionRecomendada = 'Revisar costos y márgenes de la OT foco (utilidad / cobro).';
    nivelRiesgo = 'medio';
    estadoGeneral = 'Atención';
  } else if (diagnostics.overall === 'error') {
    reglasDisparadas.push('diagnostico_error');
    accionRecomendada = 'Revisar sistema según diagnóstico: corregir errores antes de operar.';
    nivelRiesgo = 'alto';
    estadoGeneral = 'Crítico';
  } else if (diagnostics.overall === 'warning') {
    reglasDisparadas.push('diagnostico_warning');
    accionRecomendada = 'Revisar integración y calidad de datos (advertencias en diagnóstico).';
    nivelRiesgo = 'medio';
    estadoGeneral = 'Atención';
  } else {
    reglasDisparadas.push('estable');
    accionRecomendada = 'Sin acción crítica sugerida con la muestra actual.';
    nivelRiesgo = 'bajo';
    estadoGeneral = 'OK';
  }

  if (diagnostics.overall === 'error' && nivelRiesgo !== 'alto') {
    nivelRiesgo = 'alto';
    estadoGeneral = 'Crítico';
  }

  return {
    accionRecomendada,
    nivelRiesgo,
    estadoGeneral,
    reglasDisparadas,
    diagnostics,
  };
}
