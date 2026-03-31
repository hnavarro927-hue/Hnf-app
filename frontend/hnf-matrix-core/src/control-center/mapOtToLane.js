/**
 * Mapea una OT del backend HNF al carril del Kanban operativo.
 * Usa solo campos persistidos: estado, tipoServicio, aprobacionLynEstado, enviadoCliente.
 *
 * Carriles (orden de evaluación: más terminal primero donde aplica):
 * cerrado → enviado → aprobado → observado → pendiente_aprobacion → en_proceso → ingreso
 */

export const KANBAN_LANE_IDS = [
  'ingreso',
  'en_proceso',
  'pendiente_aprobacion',
  'observado',
  'aprobado',
  'enviado',
  'cerrado',
];

/** @param {Record<string, unknown>} ot */
export function mapOtToLane(ot) {
  if (!ot || typeof ot !== 'object') return 'ingreso';

  const estado = String(ot.estado ?? '')
    .trim()
    .toLowerCase();
  const lyn = String(ot.aprobacionLynEstado ?? '')
    .trim()
    .toLowerCase();
  const tipo = String(ot.tipoServicio ?? '')
    .trim()
    .toLowerCase();
  const ambitoLyn = tipo === 'clima' || tipo === 'flota';
  const enviado = Boolean(ot.enviadoCliente);

  if (estado === 'facturada' || estado === 'finalizada') return 'cerrado';
  if (lyn === 'rechazado_lyn') return 'cerrado';

  if (enviado) return 'enviado';
  if (lyn === 'aprobado_lyn') return 'aprobado';
  if (lyn === 'observado_lyn') return 'observado';
  if (lyn === 'pendiente_revision_lyn') return 'pendiente_aprobacion';
  if (lyn === 'devuelto_operaciones') return 'en_proceso';

  if (estado === 'cerrada') {
    if (ambitoLyn && !lyn) return 'pendiente_aprobacion';
    return 'cerrado';
  }

  if (estado === 'en_proceso') return 'en_proceso';
  if (estado === 'pendiente_validacion' || estado === 'nueva' || estado === 'asignada') {
    return 'ingreso';
  }

  return 'ingreso';
}
