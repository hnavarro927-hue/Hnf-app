/**
 * Ensambla recomendaciones estilo HNF (Datos / Acción / Mejora).
 */

import { suggestAssignmentForOt } from './assignment-rules.js';
import { resolveOperationalPriority } from './priority-rules.js';
import { clientPolicyRecommendations } from './client-rules.js';

export function buildHnfStyleRecommendations(snapshot) {
  const recs = [];

  const ctrl = snapshot.operationalControl;
  if (ctrl.sinTecnico > 0) {
    recs.push({
      datos: `${ctrl.sinTecnico} OT abiertas sin técnico asignado.`,
      accionSugerida: 'Asignar en Clima priorizando zona y subtipo (reglas v1 Bernabé / Andrés / Yohnatan como guía).',
      mejoraSugerida: 'Activar modo automático solo donde la operación lo valide; mantener override manual siempre visible.',
    });
  }

  if (snapshot.timingAlerts?.alerts?.length) {
    const a = snapshot.timingAlerts.alerts[0];
    recs.push({
      datos: a.text,
      accionSugerida: 'Revisar OT en panel en vivo y actualizar estado o asignación.',
      mejoraSugerida: 'Ajustar umbrales por cliente crítico en una siguiente versión de reglas.',
    });
  }

  if (snapshot.climateBoard?.tiendasPendientesAprobacion?.length) {
    const n = snapshot.climateBoard.tiendasPendientesAprobacion.length;
    recs.push({
      datos: `${n} visita(s) de mantención esta semana sin correo de aprobación vinculado por tienda.`,
      accionSugerida: 'Romina: cerrar loop de permiso antes de despachar equipo.',
      mejoraSugerida: 'Unificar estado de aprobación por sucursal en un solo tablero.',
    });
  }

  if (snapshot.flowGaps?.length) {
    recs.push({
      datos: `${snapshot.flowGaps.length} OT con paso de flujo incompleto o inconsistente.`,
      accionSugerida: snapshot.flowGaps[0]?.gap || 'Revisar clasificación y asignación antes de ejecución.',
      mejoraSugerida: 'Checklist de ingreso obligatorio para subtipo y origen.',
    });
  }

  const sampleOt = snapshot.sampleOt;
  if (sampleOt) {
    const asg = suggestAssignmentForOt(sampleOt, {});
    const pri = resolveOperationalPriority(sampleOt);
    const pol = clientPolicyRecommendations(sampleOt);
    if (asg.suggest) {
      recs.push({
        datos: `Prioridad inferida: ${pri.level}. Cliente: ${String(sampleOt.cliente || '').slice(0, 40)}.`,
        accionSugerida: asg.canAutoApply
          ? `Modo automático: se sugiere asignar a ${asg.suggest}.`
          : `Sugerencia de asignación: ${asg.suggest} (${asg.rationale}).`,
        mejoraSugerida: pol.lines[0] || 'Alinear reglas de cliente en base de datos corporativa.',
      });
    }
  }

  return recs.slice(0, 5);
}
