import { getEffectiveEstadoOperativo } from './hnf-ot-state-engine.js';

function hoursSinceIso(iso) {
  const t = new Date(String(iso || '')).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
}

/**
 * Recomendaciones según OT seleccionada (datos reales, sin texto fijo genérico).
 * @param {object|null|undefined} ot — preferible ya normalizada
 * @returns {string[]}
 */
export function buildJarvisOperationalRecommendations(ot) {
  if (!ot || typeof ot !== 'object') return [];

  const lines = [];
  const resp = String(ot.responsable_actual ?? ot.responsableActual ?? '').trim();
  if (!resp) {
    lines.push('Sin responsable asignado · asignar Romina (clima), Gery (flota) o técnico en campo.');
  }

  const st = String(ot.estadoOperativo || getEffectiveEstadoOperativo(ot)).toLowerCase();
  const hIngreso = hoursSinceIso(ot.fecha_creacion);
  if (st === 'ingreso' && hIngreso != null && hIngreso > 24) {
    lines.push(
      `OT en ingreso hace ${Math.floor(hIngreso)}h · riesgo de estancamiento; validar datos y pasar a en_proceso.`
    );
  }

  const hProc = hoursSinceIso(ot.fecha_actualizacion);
  if (st === 'en_proceso' && hProc != null && hProc > 48) {
    lines.push(
      `En proceso hace ${Math.floor(hProc)}h · alerta de ciclo largo; revisar bloqueos o evidencias.`
    );
  }

  const pri = String(ot.prioridadOperativa ?? ot.prioridadSugerida ?? '').toLowerCase();
  if (pri === 'alta') {
    lines.push('Prioridad alta · ubicar al inicio de la cola operativa del día.');
  }

  if (ot.riesgoDetectado === true) {
    lines.push('Riesgo detectado en datos de OT · revisión Lyn / gerencia sugerida.');
  }

  if (!lines.length) {
    lines.push('Sin señales críticas en esta OT con las reglas actuales (tiempos + prioridad + responsable).');
  }

  return lines;
}
