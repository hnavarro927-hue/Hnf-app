import { OT_ESTADO_FLUJO } from './hnf-ot-operational-model.js';
import { getEffectiveEstadoOperativo } from './hnf-ot-state-engine.js';

/**
 * Normaliza una OT para el motor operativo (única forma válida en UI).
 * @param {object} ot
 * @returns {object|null}
 */
export function normalizeOT(ot) {
  if (!ot || typeof ot !== 'object') return null;
  const id = ot.id != null && String(ot.id).trim() !== '' ? String(ot.id).trim() : null;
  if (!id) return null;

  const clone = { ...ot };
  let st = String(getEffectiveEstadoOperativo(clone) || '').toLowerCase();
  if (!OT_ESTADO_FLUJO.includes(st)) st = 'ingreso';
  clone.estadoOperativo = st;
  clone.estado_operativo = st;

  const resp = String(
    clone.responsableActual ?? clone.responsable_actual ?? clone.tecnicoAsignado ?? ''
  ).trim();
  clone.responsable_actual = resp;
  if (!clone.responsableActual && resp) clone.responsableActual = resp;

  let pri = String(clone.prioridadOperativa ?? clone.prioridadSugerida ?? clone.prioridad ?? 'media')
    .trim()
    .toLowerCase();
  if (!['alta', 'media', 'baja'].includes(pri)) pri = 'media';
  clone.prioridadOperativa = pri;
  if (!clone.prioridadSugerida) clone.prioridadSugerida = pri;

  const cre =
    clone.fecha_creacion ||
    clone.creadoEn ||
    clone.createdAt ||
    clone.fechaCreacion ||
    null;
  const act =
    clone.fecha_actualizacion ||
    clone.actualizadoEn ||
    clone.updatedAt ||
    cre ||
    new Date().toISOString();
  clone.fecha_creacion = cre ? String(cre) : new Date().toISOString();
  clone.fecha_actualizacion = String(act);

  return clone;
}
