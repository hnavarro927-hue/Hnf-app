/** Normalización de estados OT (legado + control operativo). */

export const OT_STATUS_CANONICAL = [
  'nueva',
  'asignada',
  'en_proceso',
  'pendiente_validacion',
  'cerrada',
  'finalizada',
  'facturada',
];

export const normalizeOtEstadoStored = (e) => {
  const x = String(e ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (x === 'pendiente' || x === 'nueva') return 'nueva';
  if (x === 'asignada') return 'asignada';
  if (x === 'en_proceso' || x === 'proceso') return 'en_proceso';
  if (x === 'pendiente_validacion' || x === 'pendiente_validación') return 'pendiente_validacion';
  if (x === 'terminado' || x === 'cerrada' || x === 'cerrado') return 'cerrada';
  if (x === 'finalizada' || x === 'finalizado') return 'finalizada';
  if (x === 'facturada' || x === 'facturado') return 'facturada';
  if (OT_STATUS_CANONICAL.includes(x)) return x;
  return 'nueva';
};

export const normalizeIncomingEstadoPatch = (e) => {
  const x = String(e ?? '').trim().toLowerCase();
  if (x === 'terminado') return 'cerrada';
  return normalizeOtEstadoStored(e);
};

/** Incluye cierre operativo y etapas de facturación. */
export const isOtCerrada = (estado) => {
  const n = normalizeOtEstadoStored(estado);
  return n === 'cerrada' || n === 'finalizada' || n === 'facturada';
};

/** Solo «cerrada» dispara checklist estricto (evidencias / economía) al cerrar. */
export const isOtCierreEstricto = (estado) => normalizeOtEstadoStored(estado) === 'cerrada';
