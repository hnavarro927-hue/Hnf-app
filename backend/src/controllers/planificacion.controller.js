import { planClienteModel } from '../models/planCliente.model.js';
import { planMantencionModel } from '../models/planMantencion.model.js';
import { planTiendaModel } from '../models/planTienda.model.js';
import { planificacionService } from '../services/planificacion.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

const searchParams = (request) => new URL(request.url || '/', 'http://localhost').searchParams;

export const getPlanClientes = async (request, response) => {
  const data = await planificacionService.listClientes();
  sendSuccess(response, 200, data, { resource: 'clientes', model: planClienteModel });
};

export const postPlanCliente = async (request, response) => {
  const result = await planificacionService.createCliente(request.body || {});
  if (result.errors) {
    return sendError(response, 400, 'Datos de cliente inválidos.', { validations: result.errors });
  }
  sendSuccess(response, 201, result, { resource: 'clientes', action: 'create' });
};

export const getPlanTiendas = async (request, response) => {
  const clienteId = searchParams(request).get('clienteId') || '';
  const data = await planificacionService.listTiendas(clienteId || undefined);
  sendSuccess(response, 200, data, { resource: 'tiendas', model: planTiendaModel, clienteId: clienteId || null });
};

export const postPlanTienda = async (request, response) => {
  const result = await planificacionService.createTienda(request.body || {});
  if (result.errors) {
    return sendError(response, 400, 'Datos de tienda inválidos.', { validations: result.errors });
  }
  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'tiendas' });
  }
  sendSuccess(response, 201, result, { resource: 'tiendas', action: 'create' });
};

export const getPlanMantenciones = async (request, response) => {
  const sp = searchParams(request);
  const fecha = sp.get('fecha') || '';
  const tecnico = sp.get('tecnico') || '';
  const filters = {};
  if (fecha) filters.fecha = fecha;
  if (tecnico) filters.tecnico = tecnico;
  const data = await planificacionService.listMantenciones(filters);
  sendSuccess(response, 200, data, {
    resource: 'mantenciones',
    model: planMantencionModel,
    filters: { fecha: fecha || null, tecnico: tecnico || null },
  });
};

export const postPlanMantencion = async (request, response) => {
  const result = await planificacionService.createMantencion(request.body || {});
  if (result.errors) {
    return sendError(response, 400, 'Datos de mantención inválidos.', { validations: result.errors });
  }
  if (result.error) {
    if (result.code === 'SCHEDULE_CONFLICT') {
      return sendError(response, 409, result.error, { resource: 'mantenciones', code: result.code });
    }
    return sendError(response, 404, result.error, { resource: 'mantenciones' });
  }
  sendSuccess(response, 201, result, { resource: 'mantenciones', action: 'create' });
};

export const patchPlanMantencion = async (request, response) => {
  const id = request.params?.id;
  const result = await planificacionService.patchMantencion(id, request.body || {});
  if (result.errors) {
    return sendError(response, 400, 'Actualización inválida.', { validations: result.errors });
  }
  if (result.error) {
    if (result.code === 'SCHEDULE_CONFLICT') {
      return sendError(response, 409, result.error, { resource: 'mantenciones', code: result.code });
    }
    return sendError(response, 404, result.error, { resource: 'mantenciones' });
  }
  sendSuccess(response, 200, result, { resource: 'mantenciones', action: 'patch' });
};
