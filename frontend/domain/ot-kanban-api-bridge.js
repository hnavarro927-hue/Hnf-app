/**
 * Persistencia Kanban → API real (/ots/...), sin tocar el backend.
 * OT solo-flujo-local (ingesta) sigue en hnf-ot-flow-storage.
 */

import { isHnfLocalFlowOt } from './hnf-ot-operational-model.js';
import { persistEstadoOperativo } from './hnf-ot-flow-storage.js';

/**
 * @param {object} ot
 * @param {string} targetLaneId
 * @param {{ updateStatus: Function, patchLyn: Function, enviarCliente: Function }} api
 * @returns {Promise<{ ok: boolean, message?: string, hint?: string }>}
 */
export async function commitKanbanLaneToServer(ot, targetLaneId, api) {
  const lane = String(targetLaneId || '').toLowerCase();
  if (!ot || ot.id == null) {
    return { ok: false, message: 'OT inválida.' };
  }

  if (isHnfLocalFlowOt(ot)) {
    const r = persistEstadoOperativo(ot, lane);
    if (!r.ok) return { ok: false, message: r.error || 'No se pudo mover (flujo local).' };
    return { ok: true, hint: 'OT local: movida en este equipo (aún no en servidor).' };
  }

  const id = String(ot.id);
  const tipo = String(ot.tipoServicio || '').toLowerCase();
  const ambitoLyn = tipo === 'clima' || tipo === 'flota';

  try {
    if (lane === 'ingreso') {
      await api.updateStatus(id, { estado: 'nueva' });
      return { ok: true, hint: 'Estado servidor: nueva (ingreso).' };
    }
    if (lane === 'en_proceso') {
      await api.updateStatus(id, { estado: 'en_proceso' });
      return { ok: true, hint: 'Estado servidor: en proceso.' };
    }
    if (lane === 'pendiente_aprobacion') {
      await api.updateStatus(id, { estado: 'pendiente_validacion' });
      return { ok: true, hint: 'Estado servidor: pendiente validación / cola Lyn.' };
    }
    if (lane === 'observado' || lane === 'aprobado') {
      if (!ambitoLyn) {
        return {
          ok: false,
          message: 'Columnas Lyn aplican a OT Clima o Flota. Usá otro estado o el detalle operativo.',
        };
      }
      const accion = lane === 'observado' ? 'observar' : 'aprobar';
      await api.patchLyn(id, { accion });
      return { ok: true, hint: accion === 'aprobar' ? 'Lyn: aprobado.' : 'Lyn: observado.' };
    }
    if (lane === 'enviado') {
      await api.enviarCliente(id);
      return { ok: true, hint: 'Marcado como enviado al cliente (simulado).' };
    }
    if (lane === 'cerrado') {
      await api.updateStatus(id, { estado: 'cerrada' });
      return { ok: true, hint: 'Estado servidor: cerrada.' };
    }
    return { ok: false, message: `Columna desconocida: ${lane}` };
  } catch (e) {
    const msg =
      e?.message ||
      e?.error?.message ||
      'El servidor rechazó el movimiento (permisos, evidencias o reglas de cierre).';
    return { ok: false, message: String(msg) };
  }
}
