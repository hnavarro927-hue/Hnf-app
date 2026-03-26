/**
 * Motor de decisión Jarvis — estado, impacto monetario, acción y prioridad temporal.
 * input: { unified } desde getJarvisUnifiedState, o { text } para ingesta manual.
 */

import { classifyIntakeText, mapIntakeToPrioridad } from './jarvis-active-intake-engine.js';
import { getJarvisRecurringPatterns } from './jarvis-memory.js';

export const JARVIS_DECISION_ENGINE_VERSION = '2026-03-24';

function prioridadTemporalFromEstado(estado) {
  if (estado === 'CRITICO') return 'inmediata';
  if (estado === 'ALTO') return 'hoy';
  return 'seguimiento';
}

function estadoFromPrioridadJarvis(p) {
  if (p === 'CRITICO') return 'CRITICO';
  if (p === 'ALTO') return 'ALTO';
  return 'NORMAL';
}

/**
 * @param {{ unified?: object, text?: string }} input
 */
export function buildJarvisDecisionEngine(input = {}) {
  if (input.text != null && String(input.text).trim()) {
    const c = classifyIntakeText(String(input.text), 'decision_engine');
    const pj = mapIntakeToPrioridad(c);
    const estado = estadoFromPrioridadJarvis(pj);
    const impacto = Math.round(Number(c.impactoEconomicoEstimado) || 0);
    const accion = String(c.accionInmediata || 'Asignar dueño y siguiente paso.').slice(0, 280);
    return {
      version: JARVIS_DECISION_ENGINE_VERSION,
      estado,
      impacto,
      accion,
      prioridad: prioridadTemporalFromEstado(estado),
      cliente: c.excerpt?.slice(0, 120) || null,
    };
  }

  const u = input.unified || input;
  if (!u || typeof u !== 'object') {
    return {
      version: JARVIS_DECISION_ENGINE_VERSION,
      estado: 'NORMAL',
      impacto: 0,
      accion: 'Cargar datos operativos para mapa ejecutable.',
      prioridad: 'seguimiento',
      cliente: null,
    };
  }

  const ad = u.jarvisAlienDecisionCore || {};
  const cr = u.jarvisFrictionPressure?.capaRealidad || {};
  const mp = u.jarvisFrictionPressure?.modoPresion || {};
  const bloqueado = Math.round(Number(cr.ingresoBloqueado) || 0);

  let estado = 'NORMAL';
  if (ad.estadoGlobal === 'critico' || mp.nivel === 'alta') estado = 'CRITICO';
  else if (ad.estadoGlobal === 'tension' || mp.nivel === 'media') estado = 'ALTO';

  const patterns = getJarvisRecurringPatterns();
  if (patterns.cuellosRepetidos?.length >= 2 && estado === 'NORMAL') {
    estado = 'ALTO';
  }

  const topAcc = ad.top3Acciones?.[0];
  const accion = String(
    ad.focoDelDia || topAcc?.accion || 'Validar un cierre o cobro con dueño explícito hoy.'
  ).slice(0, 280);

  return {
    version: JARVIS_DECISION_ENGINE_VERSION,
    estado,
    impacto: bloqueado,
    accion,
    prioridad: prioridadTemporalFromEstado(estado),
    cliente: topAcc?.responsable || null,
  };
}
