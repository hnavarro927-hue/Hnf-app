/**
 * Estados formales de revisión gerencial Lyn sobre OT Clima / Flota (cerradas).
 */

export const LYN_APROBACION_ESTADOS = [
  'pendiente_revision_lyn',
  'observado_lyn',
  'aprobado_lyn',
  'devuelto_operaciones',
  'rechazado_lyn',
];

/** Acciones que Lyn puede ejecutar vía API. */
export const LYN_APROBACION_ACCIONES = ['aprobar', 'observar', 'devolver', 'rechazar', 'comentar'];

export function normalizeAprobacionLynEstado(v) {
  const x = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!x || x === 'null' || x === 'sin_aplica') return null;
  return LYN_APROBACION_ESTADOS.includes(x) ? x : null;
}

export function otEnAmbitoLynAprobacion(ot) {
  const tipo = String(ot?.tipoServicio || '').toLowerCase().trim();
  return tipo === 'clima' || tipo === 'flota';
}

/**
 * Al cerrar OT (cerrada), entra a cola Lyn si aplica.
 */
export function debeEntrarColaLynAlCerrar(ot, estadoNormalizadoCerrada) {
  if (!otEnAmbitoLynAprobacion(ot)) return false;
  if (estadoNormalizadoCerrada !== 'cerrada') return false;
  const cur = normalizeAprobacionLynEstado(ot?.aprobacionLynEstado);
  return cur === null || cur === 'devuelto_operaciones';
}

/**
 * @param {string|null} estadoActual - normalizeAprobacionLynEstado
 * @param {string} accion - LYN_APROBACION_ACCIONES
 */
export function resolverTransicionLyn(estadoActual, accion) {
  const a = String(accion || '').toLowerCase().trim();
  if (!LYN_APROBACION_ACCIONES.includes(a)) return { ok: false, error: 'Acción inválida.' };

  if (a === 'comentar') {
    return { ok: true, nuevoEstado: estadoActual, soloComentario: true };
  }

  const e = estadoActual;

  if (e === 'aprobado_lyn' || e === 'rechazado_lyn') {
    if (a === 'comentar') return { ok: true, nuevoEstado: e, soloComentario: true };
    return { ok: false, error: 'Esta OT ya no admite cambios de estado Lyn (aprobada o rechazada).' };
  }

  if (e !== 'pendiente_revision_lyn' && e !== 'observado_lyn' && e !== 'devuelto_operaciones') {
    return { ok: false, error: 'La OT no está en cola de revisión Lyn.' };
  }

  if (a === 'aprobar') return { ok: true, nuevoEstado: 'aprobado_lyn', listoEnviarCliente: true };
  if (a === 'observar') return { ok: true, nuevoEstado: 'observado_lyn', listoEnviarCliente: false };
  if (a === 'devolver') return { ok: true, nuevoEstado: 'devuelto_operaciones', listoEnviarCliente: false, reabrirEnProceso: true };
  if (a === 'rechazar') return { ok: true, nuevoEstado: 'rechazado_lyn', listoEnviarCliente: false };

  return { ok: false, error: 'Transición no permitida.' };
}

export function etiquetaEstadoLyn(estado) {
  const m = {
    pendiente_revision_lyn: 'Pendiente revisión',
    observado_lyn: 'Observado',
    aprobado_lyn: 'Aprobado',
    devuelto_operaciones: 'Devuelto a operaciones',
    rechazado_lyn: 'Rechazado',
  };
  const k = normalizeAprobacionLynEstado(estado);
  return k ? m[k] || k : 'Sin cola Lyn';
}
