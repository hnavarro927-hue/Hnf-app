/**
 * Derivación de bandeja y aviso operativo según tipo de servicio de la OT.
 * comercial → cartera (Lyn / Hernán); administrativo → backoffice Romina; flota → Gery; resto → Clima.
 */

export const bandejaFromTipoServicio = (tipo) => {
  const t = String(tipo || '').toLowerCase();
  if (t === 'flota') return 'gery';
  if (t === 'comercial') return 'comercial';
  if (t === 'administrativo') return 'administrativo';
  return 'romina';
};

export const notificacionAsignadaFromBandeja = (bandeja) => {
  const b = String(bandeja || '').toLowerCase();
  if (b === 'gery') return 'Gery';
  if (b === 'comercial') return 'Lyn';
  if (b === 'administrativo') return 'Romina';
  return 'Romina';
};

/**
 * Asignación operativa derivada solo del tipo de servicio (misma tabla que bandeja / notificación).
 * Clima → Romina · Flota → Gery · Comercial → Lyn · Administrativo → Romina.
 * No duplica reglas: compone bandejaFromTipoServicio + notificacionAsignadaFromBandeja.
 */
export function asignacionOperativaDesdeTipoServicio(tipoServicio) {
  const bandeja = bandejaFromTipoServicio(tipoServicio);
  const operadorTitular = notificacionAsignadaFromBandeja(bandeja);
  return {
    bandejaAsignada: bandeja,
    notificacionAsignadaA: operadorTitular,
    operadorTitular,
  };
}
