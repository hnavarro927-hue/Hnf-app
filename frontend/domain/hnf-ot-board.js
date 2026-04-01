/**
 * Tablero operativo de OT: buckets de estado para filtro/columna (5 estados UX).
 */

/**
 * @param {object} ot
 * @returns {'nueva'|'asignada'|'en_curso'|'finalizada'|'cerrada'}
 */
export function otBoardEstadoBucket(ot) {
  const e = String(ot?.estado || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (e === 'nueva') return 'nueva';
  if (e === 'asignada') return 'asignada';
  if (e === 'en_proceso' || e === 'en proceso' || e === 'pendiente_validacion') return 'en_curso';
  if (e === 'finalizada') return 'finalizada';
  if (e === 'cerrada' || e === 'terminado' || e === 'cerrado' || e === 'facturada') return 'cerrada';
  return 'nueva';
}

const BUCKET_LABEL = {
  nueva: 'Nueva',
  asignada: 'Asignada',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
  cerrada: 'Cerrada',
};

/**
 * @param {object} ot
 */
export function labelOtBoardEstado(ot) {
  return BUCKET_LABEL[otBoardEstadoBucket(ot)] || String(ot?.estado || '—');
}

/** Valores enviados al API PATCH /status */
export const OT_BOARD_STATUS_API_OPTIONS = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'asignada', label: 'Asignada' },
  { value: 'en_proceso', label: 'En curso' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'cerrada', label: 'Cerrada' },
];

/** Opciones filtro (valor = bucket) */
export const OT_BOARD_FILTER_ESTADO = [
  { value: '', label: 'Todos' },
  { value: 'nueva', label: 'Nueva' },
  { value: 'asignada', label: 'Asignada' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'cerrada', label: 'Cerrada' },
];
