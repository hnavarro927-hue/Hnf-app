/**
 * Normalización de solicitudes externas (WhatsApp / correo) → tipo de solicitud y módulo operativo.
 */

export function inferTipoSolicitudFromText(text) {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (
    /\b(traslado|flete|transporte|despacho|ruta|camion|camión|logistica|logística|retiro|entrega)\b/.test(t)
  ) {
    return 'traslado';
  }
  if (
    /\b(mantenci[oó]n|preventiv|hvac|clima|aire\s+acond|split|frio|frío|reparaci[oó]n|falla|equipo)\b/.test(t)
  ) {
    return 'mantención';
  }
  if (/\b(revisi[oó]n|inspecci[oó]n|chequeo|visita\s+tecnica|visita\s+técnica)\b/.test(t)) {
    return 'revisión';
  }
  return 'otro';
}

/**
 * Ajusta módulo Jarvis según tipo de solicitud explícito (prioridad sobre heurística del archivo).
 */
export function aplicarModuloPorTipoSolicitud(jarvis, tipoSolicitud) {
  const ts = String(tipoSolicitud || '').toLowerCase();
  let modulo_destino_sugerido = jarvis.modulo_destino_sugerido;
  if (ts === 'traslado') modulo_destino_sugerido = 'flota';
  else if (ts === 'mantención' || ts === 'revisión') modulo_destino_sugerido = 'clima';
  return { ...jarvis, modulo_destino_sugerido };
}

export const RESPUESTA_AUTOMATICA_INTAKE_FASE1 =
  'Recibimos tu solicitud, será gestionada por nuestro equipo.';
