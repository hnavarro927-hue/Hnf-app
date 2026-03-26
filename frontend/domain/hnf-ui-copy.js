/**
 * Texto amable para pantalla — evita tono agresivo o jerga innecesaria (p. ej. SLA).
 */

/** OT rojas del tablero operativo → lenguaje claro */
export function labelOtAtencion(bloqueos, pendientes) {
  const b = Number(bloqueos) || 0;
  const p = Number(pendientes) || 0;
  if (b > 0 && p > 0) {
    return `${b} orden${b === 1 ? '' : 'es'} crítica${b === 1 ? '' : 's'} · ${p} en revisión`;
  }
  if (b > 0) return `${b} orden${b === 1 ? '' : 'es'} crítica${b === 1 ? '' : 's'}`;
  if (p > 0) return `${p} orden${p === 1 ? '' : 'es'} en revisión`;
  return 'Sin órdenes que requieran atención urgente';
}

export function labelDineroRetenido(monto) {
  const n = Math.round(Number(monto) || 0);
  if (n <= 0) return 'Sin montos retenidos visibles';
  return `$${n.toLocaleString('es-CL')} en flujo (por cerrar o cobrar)`;
}

/** Tiempos humanos */
export function labelTiempoSinMovimiento(iso) {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return 'Sin fecha de movimiento';
  const h = Math.floor((Date.now() - t) / 3600000);
  if (h < 1) return 'Actualizado hace menos de 1 hora';
  if (h < 24) return `Sin cambios hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Sin cambios hace ${d} día${d === 1 ? '' : 's'}`;
}

export function labelUrgenciaTiempo(iso, criticoHoras = 72) {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t)) return '';
  const h = (Date.now() - t) / 3600000;
  if (h >= criticoHoras) return 'Atrasado';
  if (h >= 24) return 'Tiempo en espera';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (t >= start.getTime()) return 'Ingresó hoy';
  return '';
}

export const ETIQUETA_ESTADO_VALIDACION = {
  detectado: 'Detectado',
  requiere_validacion: 'Requiere validación',
  corregido: 'Corregido',
  confirmado: 'Confirmado',
  archivado: 'Archivado',
};
