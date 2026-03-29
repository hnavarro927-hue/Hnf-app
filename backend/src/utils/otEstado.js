/** Normalización de estados OT (legado + control operativo). */

export const OT_STATUS_CANONICAL = [
  'nueva',
  'asignada',
  'en_proceso',
  'pendiente_validacion',
  'cerrada',
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
  if (OT_STATUS_CANONICAL.includes(x)) return x;
  return 'nueva';
};

export const normalizeIncomingEstadoPatch = (e) => {
  const x = String(e ?? '').trim().toLowerCase();
  if (x === 'terminado') return 'cerrada';
  return normalizeOtEstadoStored(e);
};

export const isOtCerrada = (estado) => normalizeOtEstadoStored(estado) === 'cerrada';
