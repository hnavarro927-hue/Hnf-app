import { tecnicoService } from '../services/tecnico.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getTecnicos = async (request, response) => sendSuccess(response, 200, tecnicoService.getAll(), { resource: 'tecnicos' });

export const createTecnico = async (request, response) => {
  const row = tecnicoService.create(request.body || {});
  if (row.errors) return sendError(response, 400, 'Técnico inválido', { validations: row.errors });
  return sendSuccess(response, 201, row, { resource: 'tecnicos' });
};
