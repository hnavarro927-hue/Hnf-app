/**
 * Kanban gerencial de 4 columnas (UI). Deriva del modelo operativo completo sin tocar backend.
 */

import { mapOtToLane } from './ot-kanban-lanes.js';

export const SIMPLE_LANE_IDS = ['simp_ingreso', 'simp_proceso', 'simp_pendiente_lyn', 'simp_finalizadas'];

export const SIMPLE_LANE_LABELS = {
  simp_ingreso: 'Ingreso',
  simp_proceso: 'En proceso',
  simp_pendiente_lyn: 'Pendiente aprobación',
  simp_finalizadas: 'Finalizado',
};

/** @param {Record<string, unknown>} ot */
export function mapOtToSimpleLane(ot) {
  const full = mapOtToLane(ot);
  if (full === 'enviado' || full === 'cerrado') return 'simp_finalizadas';
  if (full === 'pendiente_aprobacion' || full === 'observado' || full === 'aprobado') {
    return 'simp_pendiente_lyn';
  }
  if (full === 'en_proceso') return 'simp_proceso';
  return 'simp_ingreso';
}

/** Mapea columna simple → columna interna usada por commitKanbanLane (API bridge). */
export function simpleLaneToCommitLane(simpleId) {
  const m = {
    simp_ingreso: 'ingreso',
    simp_proceso: 'en_proceso',
    simp_pendiente_lyn: 'pendiente_aprobacion',
    simp_finalizadas: 'cerrado',
  };
  return m[String(simpleId)] || 'ingreso';
}
