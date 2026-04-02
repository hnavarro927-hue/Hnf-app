/**
 * Una sola alerta protagonista para el Mando (prioridad fija, datos reales).
 */

import { mapOtToSimpleLane } from './ot-simple-kanban-lanes.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

/**
 * @param {object[]} ots
 * @param {{ focoOt?: object | null }} jSig
 */
export function computePrimaryMandoAlert(ots, jSig) {
  const list = Array.isArray(ots) ? ots : [];

  let nSin = 0;
  let firstSin = null;
  for (const o of list) {
    if (mapOtToSimpleLane(o) === 'simp_finalizadas') continue;
    if (getEvidenceGaps(o).length > 0) {
      nSin += 1;
      firstSin = firstSin || o;
    }
  }
  if (nSin > 0) {
    return {
      severity: 'critical',
      message:
        nSin === 1 ? 'Hay 1 OT activa sin evidencia completa.' : `Hay ${nSin} OT activas sin evidencia completa.`,
      targetOt: firstSin,
      tab: 'evidencia',
    };
  }

  const riskList = list.filter((o) => Boolean(o?.riesgoDetectado) && mapOtToSimpleLane(o) !== 'simp_finalizadas');
  if (riskList.length > 0) {
    const pick =
      jSig?.focoOt && riskList.some((x) => String(x?.id) === String(jSig.focoOt?.id))
        ? jSig.focoOt
        : riskList[0];
    return {
      severity: 'critical',
      message:
        riskList.length === 1
          ? 'Hay 1 OT con riesgo detectado.'
          : `Hay ${riskList.length} OT con riesgo detectado.`,
      targetOt: pick,
      tab: 'detalle',
    };
  }

  const pend = list.filter((o) => mapOtToSimpleLane(o) === 'simp_pendiente_lyn');
  if (pend.length > 0) {
    return {
      severity: 'warn',
      message:
        pend.length === 1
          ? 'Hay 1 OT pendiente de aprobación.'
          : `Hay ${pend.length} OT pendientes de aprobación.`,
      targetOt: pend[0],
      tab: 'detalle',
    };
  }

  return {
    severity: 'ok',
    message: 'Sin alertas prioritarias. El tablero está al día.',
    targetOt: null,
    tab: 'detalle',
  };
}
