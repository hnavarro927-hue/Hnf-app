import { operationalEventService } from '../services/operationalEvent.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const getOperationalEvents = async (_req, res) => {
  try {
    const events = await operationalEventService.list();
    sendSuccess(res, 200, { events }, { resource: 'operational_events' });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudieron listar eventos operativos');
  }
};

export const postOperationalEventManual = async (req, res) => {
  try {
    const actor = getRequestActor(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const text = String(body.mensaje_original || body.texto || '').trim();
    if (!text) {
      return sendError(res, 400, 'mensaje_original o texto es obligatorio.', {
        resource: 'operational_events',
      });
    }
    const event = await operationalEventService.createManual(body, actor);
    sendSuccess(res, 201, { event }, { resource: 'operational_events', action: 'create' });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudo crear el evento');
  }
};

export const patchOperationalEventEstado = async (req, res) => {
  try {
    const actor = getRequestActor(req);
    const id = req.params?.id || '';
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const estado = String(body.estado || '').trim();
    if (!id || !estado) {
      return sendError(res, 400, 'id y estado son obligatorios.', { resource: 'operational_events' });
    }
    const result = await operationalEventService.transitionEstado(id, {
      estado,
      actor,
      nota: body.nota,
    });
    if (result?.error) {
      return sendError(res, 400, result.error, { resource: 'operational_events' });
    }
    sendSuccess(res, 200, { event: result }, { resource: 'operational_events', action: 'estado' });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudo actualizar estado');
  }
};

export const getOperationalEventInforme = async (req, res) => {
  try {
    const id = req.params?.id || '';
    const informe = await operationalEventService.informeInterno(id);
    if (!informe) {
      return sendError(res, 404, 'Evento no encontrado.', { resource: 'operational_events' });
    }
    sendSuccess(res, 200, { informe }, { resource: 'operational_events', action: 'informe_interno' });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudo generar informe');
  }
};

export const getOperationalPanelDaily = async (_req, res) => {
  try {
    const panel = await operationalEventService.buildDailyPanelSnapshot();
    sendSuccess(res, 200, { panel }, { resource: 'operational_panel', action: 'daily' });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudo armar el panel diario');
  }
};
