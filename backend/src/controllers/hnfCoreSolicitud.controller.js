import { hnfCoreSolicitudModel } from '../models/hnfCoreSolicitud.model.js';
import { hnfCoreSolicitudService } from '../services/hnfCoreSolicitud.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

const searchParams = (request) => new URL(request.url || '/', 'http://localhost').searchParams;

export const getHnfCoreSolicitudes = async (request, response) => {
  const sp = searchParams(request);
  const filters = {};
  const tipo = sp.get('tipo');
  const estado = sp.get('estado');
  const origen = sp.get('origen');
  const responsable = sp.get('responsable');
  const inbox = sp.get('inbox');

  if (tipo) filters.tipo = tipo;
  if (estado) filters.estado = estado;
  if (origen) filters.origen = origen;
  if (responsable) filters.responsable = responsable;

  let data = await hnfCoreSolicitudService.list(filters);

  if (inbox === 'lyn') {
    data = data.filter((s) => s.estado === 'pendiente_aprobacion' || s.estado === 'observado');
  }

  sendSuccess(response, 200, data, {
    resource: 'hnf-core/solicitudes',
    model: hnfCoreSolicitudModel,
    filters: { ...filters, inbox: inbox || null },
  });
};

export const getHnfCoreSolicitudById = async (request, response) => {
  const id = request.params?.id;
  const row = await hnfCoreSolicitudService.getById(id);
  if (!row) {
    return sendError(response, 404, 'Solicitud no encontrada.', { resource: 'hnf-core/solicitudes' });
  }
  sendSuccess(response, 200, row, { resource: 'hnf-core/solicitudes', action: 'get' });
};

export const postHnfCoreSolicitud = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await hnfCoreSolicitudService.create(request.body || {}, actor);
  if (result.errors) {
    return sendError(response, 400, 'Datos inválidos.', { validations: result.errors });
  }
  sendSuccess(response, 201, result, { resource: 'hnf-core/solicitudes', action: 'create' });
};

export const patchHnfCoreSolicitud = async (request, response) => {
  const id = request.params?.id;
  const actor = getRequestActor(request);
  const result = await hnfCoreSolicitudService.patch(id, request.body || {}, actor);
  if (result.errors) {
    return sendError(response, 400, 'Actualización inválida.', { validations: result.errors });
  }
  if (result.error) {
    const st = result.code === 'INVALID_TRANSITION' ? 422 : 404;
    return sendError(response, st, result.error, { code: result.code });
  }
  sendSuccess(response, 200, result, { resource: 'hnf-core/solicitudes', action: 'patch' });
};
