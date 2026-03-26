/**
 * ADN decisión: responsables fijos por área + acción obligatoria + impacto cuantificado.
 * Jarvis no deja campos críticos vacíos en la interpretación enriquecida.
 */

const FALLBACK_ACCION = 'Asignar responsable y ventana horaria en panel operativo';
const FALLBACK_DETECT = 'Señal operativa indexada — Jarvis clasificó contexto y riesgo.';

/** @param {string} area @param {object} flags @param {object} ev */
export function assignResponsableAutomatico(area, flags, ev) {
  const e = ev || {};
  if (area === 'comercial' || flags?.comercial || e.generaOportunidad) return 'Gery';
  if (area === 'flota' || flags?.flota) return 'Romina';
  if (area === 'clima' || flags?.clima) {
    const t = String(e.tecnicoAsignado || e.tecnico || e.responsableTecnico || '').trim();
    if (t) return t;
    return 'Técnico según OT (definir en Clima)';
  }
  return 'Romina';
}

/**
 * Una sola acción canónica visible (ACCIÓN RECOMENDADA / obligatoria).
 * @param {object} interp
 * @param {object} ev
 */
export function buildAccionObligatoria(interp, ev) {
  const f = interp?.flags || {};
  const e = ev || {};
  if (f.evidencia_faltante) return 'Solicitar evidencia';
  if (f.cierre_pendiente) return 'Cerrar OT / completar visita';
  if (f.flota) return 'Gestionar flota o traslado';
  if (interp?.area_sugerida === 'comercial' || f.comercial || e.generaOportunidad) {
    return 'Generar propuesta comercial';
  }
  if (interp?.prioridad_raw === 'CRITICO') return 'Cobrar / desbloquear caja urgente';
  if (interp?.prioridad_raw === 'ALTO') return 'Cobrar o formalizar cierre con evidencia';
  return 'Crear o actualizar OT con dueño explícito';
}

/**
 * Monto referencia para UI ($) cuando no hay heurística numérica.
 */
export function computeImpactoDineroReferencia(interp, ev) {
  const e = ev || {};
  const h = Number(e.impactoEconomicoHeuristico);
  if (Number.isFinite(h) && h > 0) return Math.round(h);
  if (interp?.flags?.cierre_pendiente) return 280_000;
  if (interp?.prioridad_raw === 'CRITICO') return 520_000;
  if (interp?.prioridad_raw === 'ALTO') return 310_000;
  if (interp?.flags?.comercial || e.generaOportunidad) return 190_000;
  return 95_000;
}

export function buildImpactoEstadoLine(interp) {
  const st = String(interp?.estado_operativo || 'interpretado');
  if (st.includes('nuevo')) return 'Estado flujo: ingreso nuevo — requiere primera acción humana.';
  if (st.includes('requiere')) return 'Estado flujo: bloqueado hasta acción (evidencia, cierre o asignación).';
  if (st.includes('escalado')) return 'Estado flujo: escalado — riesgo operativo elevado.';
  return 'Estado flujo: en curso — mantener ritmo de cierre y cobro.';
}

export function buildImpactoFlujoLine(interp) {
  const a = String(interp?.area_sugerida || 'operaciones');
  if (a === 'comercial') return 'Flujo: embudo comercial — propuesta y seguimiento de cierre.';
  if (a === 'clima') return 'Flujo: ejecución técnica — OT, visita y evidencias.';
  if (a === 'flota') return 'Flujo: logística — coordinación de traslado y confirmación.';
  return 'Flujo: operación central — priorización y asignación.';
}

/**
 * @param {object} interp - salida parcial de interpretOperativeEvent / interpretProcessResult
 * @param {object} ev - evento crudo o clasificación
 */
export function enrichInterpretationWithDecisions(interp, ev) {
  if (!interp || typeof interp !== 'object') return interp;
  const accion_obligatoria = buildAccionObligatoria(interp, ev) || FALLBACK_ACCION;
  const responsable_asignado = assignResponsableAutomatico(
    interp.area_sugerida,
    interp.flags,
    ev
  );
  const impacto_dinero_referencia = computeImpactoDineroReferencia(interp, ev);
  const impacto_estado = buildImpactoEstadoLine(interp);
  const impacto_flujo = buildImpactoFlujoLine(interp);
  const area_display =
    interp.area_sugerida === 'comercial'
      ? 'Comercial'
      : interp.area_sugerida === 'clima'
        ? 'Técnico / Clima'
        : interp.area_sugerida === 'flota'
          ? 'Flota'
          : 'Operación';

  const prevActs = Array.isArray(interp.acciones_disponibles) ? interp.acciones_disponibles : [];
  const acciones_disponibles = [accion_obligatoria, ...prevActs.filter((x) => x !== accion_obligatoria)].slice(0, 8);

  return {
    ...interp,
    jarvis_detecto: String(interp.jarvis_detecto || '').trim() || FALLBACK_DETECT,
    accion_obligatoria,
    accion_recomendada_label: accion_obligatoria,
    responsable_asignado,
    responsable_sugerido: responsable_asignado,
    impacto_dinero_referencia,
    impacto_estado,
    impacto_flujo,
    area_display,
    acciones_disponibles,
  };
}
