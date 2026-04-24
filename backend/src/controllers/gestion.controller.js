import { gestionModel } from '../models/gestion.model.js';
import { gestionService } from '../services/gestion.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getAllGestiones = async (request, response) => {
  sendSuccess(response, 200, gestionService.getAll(), {
    resource: 'gestiones',
    model: gestionModel,
    repositoryMode: gestionService.repositoryMode,
  });
};

export const createGestion = async (request, response) => {
  const item = gestionService.create(request.body || {});
  if (item.errors) {
    return sendError(response, 400, 'Payload de gestión inválido.', { validations: item.errors });
  }

  return sendSuccess(response, 201, item, { resource: 'gestiones', action: 'createGestion' });
};

export const updateGestionStatus = async (request, response) => {
  const result = gestionService.updateStatus(request.params.id, request.body?.estado);
  if (result.error) {
    return sendError(response, 400, result.error, { validStatuses: gestionModel.statusOptions });
  }

  return sendSuccess(response, 200, result, { resource: 'gestiones', action: 'updateGestionStatus' });
};
