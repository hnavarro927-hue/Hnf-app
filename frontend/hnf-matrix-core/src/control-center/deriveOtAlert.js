/**
 * Alerta compacta para card — solo hechos del objeto OT, sin inventar SLA.
 * @param {Record<string, unknown>} ot
 * @returns {{ level: 'warn' | 'risk', text: string } | null}
 */
export function deriveOtAlert(ot) {
  if (!ot || typeof ot !== 'object') return null;

  const lyn = String(ot.aprobacionLynEstado ?? '')
    .trim()
    .toLowerCase();
  if (lyn === 'observado_lyn') {
    return { level: 'warn', text: 'Observado Lyn' };
  }
  if (lyn === 'devuelto_operaciones') {
    return { level: 'risk', text: 'Devuelto a operaciones' };
  }
  if (lyn === 'rechazado_lyn') {
    return { level: 'risk', text: 'Rechazado Lyn' };
  }
  if (lyn === 'pendiente_revision_lyn') {
    return { level: 'warn', text: 'Pendiente aprobación' };
  }

  const pendCliente = Boolean(ot.pendienteRespuestaCliente);
  if (pendCliente) {
    return { level: 'warn', text: 'Pend. respuesta cliente' };
  }

  return null;
}
