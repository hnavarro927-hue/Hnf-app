import { climaService } from '../services/clima.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getClimaSnapshot = async (request, response) => sendSuccess(response, 200, climaService.getSnapshot(), { resource: 'clima' });

export const importPumaStores = async (request, response) => {
  const result = climaService.importTiendas(request.body || {});
  return sendSuccess(response, 200, result, { resource: 'clima_stores_import' });
};

export const createClimaCalendario = async (request, response) => {
  const row = climaService.createCalendario(request.body || {});
  if (row.errors) return sendError(response, 400, 'Calendario inválido', { validations: row.errors });
  return sendSuccess(response, 201, row, { resource: 'clima_calendario' });
};

export const createClimaInforme = async (request, response) => sendSuccess(response, 201, climaService.createInforme(request.body || {}), { resource: 'clima_informes' });

export const createClimaOT = async (request, response) => {
  const row = climaService.createOT(request.body || {});
  if (row.errors) return sendError(response, 400, 'OT clima inválida', { validations: row.errors });
  return sendSuccess(response, 201, row, { resource: 'ot_clima' });
};

export const updateClimaOTStatus = async (request, response) => {
  const row = climaService.updateOTStatus(request.params.id, request.body || {});
  if (row.error) return sendError(response, 400, row.error);
  return sendSuccess(response, 200, row, { resource: 'ot_clima' });
};

export const requestClimaApproval = async (request, response) => {
  const row = climaService.requestSensitiveAction(request.params.id, request.body?.accion, request.body?.solicitadoPor);
  if (row.error) return sendError(response, 404, row.error);
  return sendSuccess(response, 201, row, { resource: 'aprobaciones' });
};
