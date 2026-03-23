/** Pipeline de estados flota — única fuente para UI y capa operativa/IA. */
export const FLOTA_ESTADO_CHAIN = [
  'recibida',
  'evaluacion',
  'cotizada',
  'aprobada',
  'programada',
  'en_ruta',
  'completada',
  'cerrada',
];

export const FLOTA_ESTADO_LABELS = {
  recibida: 'Recibida',
  evaluacion: 'Evaluación',
  cotizada: 'Cotizada',
  aprobada: 'Aprobada',
  programada: 'Programada',
  en_ruta: 'En ruta',
  completada: 'Completada',
  cerrada: 'Cerrada',
};

export const flotaNextEstado = (e) => {
  const i = FLOTA_ESTADO_CHAIN.indexOf(e);
  if (i < 0 || i >= FLOTA_ESTADO_CHAIN.length - 1) return null;
  return FLOTA_ESTADO_CHAIN[i + 1];
};
