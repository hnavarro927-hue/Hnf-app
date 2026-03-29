/**
 * Destino operativo y bandeja por responsable para documentos Base Maestra / Jarvis Intake.
 */

export const MAESTRO_DESTINOS = ['clima', 'flota', 'comercial', 'administrativo'];

/** Normaliza módulo Jarvis → destino operativo. */
export function normalizeDestinoModulo(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  if (MAESTRO_DESTINOS.includes(s)) return s;
  if (s === 'finanzas' || s === 'general' || s === 'control') return 'administrativo';
  return 'administrativo';
}

/**
 * Resuelve bandeja final a partir del destino (efectivo).
 * clima → romina, flota → gery, comercial → lyn, administrativo → romina
 */
export function resolveBandejaFinal(destinoFinal) {
  const destino_final = normalizeDestinoModulo(destinoFinal);
  const map = {
    clima: 'romina',
    flota: 'gery',
    comercial: 'lyn',
    administrativo: 'romina',
  };
  return {
    destino_final,
    bandeja_destino: map[destino_final] || 'romina',
    area_detectada: destino_final,
  };
}

/** Etiqueta legible para copy operativo. */
export function labelDestinoHumano(destino) {
  const d = normalizeDestinoModulo(destino);
  const m = {
    clima: 'Clima',
    flota: 'Flota',
    comercial: 'Comercial',
    administrativo: 'Administrativo',
  };
  return m[d] || d;
}

export function labelBandejaHumano(bandeja) {
  const b = String(bandeja || '').toLowerCase();
  const m = { romina: 'Romina', gery: 'Gery', lyn: 'Lyn', admin: 'Admin' };
  return m[b] || bandeja || '—';
}

/** Comprueba si algún bloque Jarvis pide revisión manual. */
export function documentoTieneRevisionManualSugerida(doc) {
  const v = doc?.jarvis_vinculacion;
  if (!v || typeof v !== 'object') return false;
  return ['cliente', 'contacto', 'vehiculo', 'tecnico'].some(
    (k) => v[k]?.estado === 'revision_manual_sugerida'
  );
}

/**
 * Campos de destino por defecto desde fila persistida (migración suave en lectura).
 */
export function computeDestinoFieldsForDocument(doc) {
  const jarvisMod = normalizeDestinoModulo(doc?.modulo_destino_sugerido);
  const destino_detectado =
    doc?.destino_detectado != null && String(doc.destino_detectado).trim()
      ? normalizeDestinoModulo(doc.destino_detectado)
      : jarvisMod;
  const destino_final = doc?.destino_final != null && String(doc.destino_final).trim()
    ? normalizeDestinoModulo(doc.destino_final)
    : destino_detectado;
  const r = resolveBandejaFinal(destino_final);
  const bandeja_destino = doc?.bandeja_destino || r.bandeja_destino;
  const area_detectada =
    doc?.area_detectada != null && String(doc.area_detectada).trim()
      ? normalizeDestinoModulo(doc.area_detectada)
      : jarvisMod;
  const clasificacion_fuente = doc?.clasificacion_fuente === 'manual' ? 'manual' : 'jarvis';
  return {
    destino_detectado,
    destino_final,
    bandeja_destino,
    area_detectada,
    clasificacion_fuente,
  };
}
