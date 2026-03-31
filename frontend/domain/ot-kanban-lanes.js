/**
 * Carril Kanban operativo HNF — alineado al flujo OT de 6 estados.
 * `estadoOperativo` (persistido en local) tiene prioridad; si no, se deriva del modelo API/Lyn.
 */

import { getEffectiveEstadoOperativo, mapLegacyOtToEstadoOperativo } from './hnf-ot-state-engine.js';

export const KANBAN_LANE_IDS = [
  'ingreso',
  'en_proceso',
  'observado',
  'aprobado',
  'enviado',
  'cerrado',
];

/** @param {Record<string, unknown>} ot */
export function mapOtToLane(ot) {
  if (!ot || typeof ot !== 'object') return 'ingreso';

  const eo = String(ot.estadoOperativo ?? '')
    .trim()
    .toLowerCase();
  if (KANBAN_LANE_IDS.includes(eo)) return eo;

  return mapLegacyOtToEstadoOperativo(ot);
}

export { getEffectiveEstadoOperativo };
