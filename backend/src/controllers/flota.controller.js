import { flotaService } from '../services/flota.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getFlotaSnapshot = async (request, response) => sendSuccess(response, 200, flotaService.getSnapshot(), { resource: 'flota' });

export const createFlotaVehiculo = async (request, response) => {
  const row = flotaService.createVehiculo(request.body || {});
  if (row.errors) return sendError(response, 400, 'Vehículo inválido', { validations: row.errors });
  return sendSuccess(response, 201, row, { resource: 'vehiculos' });
};

export const createFlotaGestion = async (request, response) => sendSuccess(response, 201, flotaService.createGestion(request.body || {}), { resource: 'gestion_diaria_flota' });

export const createFlotaOT = async (request, response) => {
  const row = flotaService.createOT(request.body || {});
  if (row.errors) return sendError(response, 400, 'OT flota inválida', { validations: row.errors });
  return sendSuccess(response, 201, row, { resource: 'ot_flota' });
};

export const updateFlotaOTStatus = async (request, response) => {
  const row = flotaService.updateOTStatus(request.params.id, request.body || {});
  if (row.error) return sendError(response, 400, row.error);
  return sendSuccess(response, 200, row, { resource: 'ot_flota' });
};
