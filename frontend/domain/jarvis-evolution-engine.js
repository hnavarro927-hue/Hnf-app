/**
 * Jarvis Evolution Engine — sugerencias de mejora y ajuste de reglas (solo lectura).
 */

export const JARVIS_EVOLUTION_VERSION = '2026-03-24';

const UMBRAL_REF_CLP = 450_000;

/**
 * @param {object} unified
 * @param {object} [runtimeSnap]
 */
export function runJarvisEvolutionEngine(unified, runtimeSnap = {}) {
  const u = unified || {};
  const fi = u.jarvisFlowIntelligence;
  const flow = fi?.flowState;
  const econ = fi?.economicState;
  const priority = fi?.priorityEngine;
  const findings = u.autonomicState?.analysis?.findings || [];

  /** @type {string[]} */
  const patronesDetectados = [];
  /** @type {string[]} */
  const sugerencias = [];

  if (priority?.codigo === 'liberar_ingresos' && (econ?.ingresoBloqueado || 0) < UMBRAL_REF_CLP * 0.4) {
    patronesDetectados.push('prioridad_liberar_ingresos_con_bloqueo_medio');
    sugerencias.push(
      'Regla de ingreso bloqueado posiblemente subestimada: el foco es “liberar” pero el monto bloqueado está por debajo del umbral habitual — valorar umbral dinámico por ticket medio.'
    );
  }

  if (priority?.codigo === 'flujo_operativo' && (econ?.ingresoBloqueado || 0) > UMBRAL_REF_CLP * 1.2) {
    patronesDetectados.push('bloqueo_alto_sin_prioridad_dinero');
    sugerencias.push(
      'Ingreso bloqueado alto sin prioridad “liberar ingresos” — revisar coherencia entre heurística económica y motor de prioridad.'
    );
  }

  if (flow?.ritmo === 'bajo' && (flow?._meta?.closedLast7d ?? 0) <= 1) {
    patronesDetectados.push('ritmo_bajo_sostenido');
    sugerencias.push(
      'Cierre semanal muy bajo: sugerir SLA explícito de cierre de OT y bloque diario de “cierre + facturación”.'
    );
  }

  const codes = findings.map((f) => f.code).filter(Boolean);
  const dup = codes.filter((c, i) => codes.indexOf(c) !== i);
  if (dup.length) {
    patronesDetectados.push('hallazgos_mape_repetitivos');
    sugerencias.push(
      `Hallazgos MAPE repetidos (${[...new Set(dup)].join(', ')}): consolidar reglas o subir umbral de alerta para reducir fatiga.`
    );
  }

  if ((runtimeSnap.pulse?.lightSkips ?? 0) > 20) {
    patronesDetectados.push('pulse_ciclos_livianos_frecuentes');
    sugerencias.push(
      'Muchos ciclos livianos seguidos: la huella de datos casi no cambia — valorar ampliar fingerprint (campos sensibles) o bajar intervalo si necesitás más MAPE.'
    );
  }

  const op = u.jarvisOperador || {};
  if (op.jarvisModo === 'inferencial') {
    patronesDetectados.push('operacion_en_modo_inferencial');
    sugerencias.push(
      'Jarvis está completando vacíos con heurística: automatizar ingesta mínima diaria (OT + 1 oportunidad + documentos) para bajar incertidumbre.'
    );
  }
  const discN = op.opportunityDiscovery?.oportunidades?.length || 0;
  if (discN >= 3 && !(u.commercialOpportunities || []).length) {
    patronesDetectados.push('oportunidades_solo_descubiertas_sin_pipeline');
    sugerencias.push(
      'Muchas oportunidades inferidas y cero en ERP: regla sugerida — toda OT cerrada debe generar tarea comercial de upsell en 48h.'
    );
  }
  const hidN = op.hiddenErrors?.items?.length || 0;
  if (hidN >= 4) {
    patronesDetectados.push('errores_ocultos_frecuentes');
    sugerencias.push(
      'Patrón de errores de negocio repetido: proponer checklist de cierre (facturación + envío doc + asignación técnico).'
    );
  }

  if (!sugerencias.length) {
    sugerencias.push('Sin patrones evolutivos fuertes en este corte — mantener versión estable de reglas.');
  }

  return {
    version: JARVIS_EVOLUTION_VERSION,
    patronesDetectados,
    sugerencias,
    meta: {
      umbralReferenciaIngresoBloqueado: UMBRAL_REF_CLP,
    },
  };
}

export { runJarvisEvolutionEngine as runSystemEvolutionEngine };
