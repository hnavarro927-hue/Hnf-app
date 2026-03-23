import { solicitudFlotaModel } from '../models/solicitudFlota.model.js';
import { flotaSolicitudService } from '../services/flotaSolicitud.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

const searchParams = (request) => new URL(request.url || '/', 'http://localhost').searchParams;

export const getFlotaSolicitudes = async (request, response) => {
  const sp = searchParams(request);
  const cliente = sp.get('cliente') || '';
  const estado = sp.get('estado') || '';
  const filters = {};
  if (cliente) filters.cliente = cliente;
  if (estado) filters.estado = estado;
  const data = await flotaSolicitudService.list(filters);
  sendSuccess(response, 200, data, {
    resource: 'flota/solicitudes',
    model: solicitudFlotaModel,
    filters: { cliente: cliente || null, estado: estado || null },
  });
};

export const postFlotaSolicitud = async (request, response) => {
  const result = await flotaSolicitudService.create(request.body || {});
  if (result.errors) {
    return sendError(response, 400, 'Solicitud inválida.', { validations: result.errors });
  }
  sendSuccess(response, 201, result, { resource: 'flota/solicitudes', action: 'create' });
};

export const patchFlotaSolicitud = async (request, response) => {
  const id = request.params?.id;
  const result = await flotaSolicitudService.patch(id, request.body || {});
  if (result.errors) {
    return sendError(response, 400, 'Actualización inválida.', { validations: result.errors });
  }
  if (result.error) {
    const rule = result.code?.startsWith('RULE_');
    return sendError(response, rule ? 422 : 404, result.error, {
      resource: 'flota/solicitudes',
      code: result.code,
    });
  }
  sendSuccess(response, 200, result, { resource: 'flota/solicitudes', action: 'patch' });
};
