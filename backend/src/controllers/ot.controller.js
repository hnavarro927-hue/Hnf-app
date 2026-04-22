import { otModel } from '../models/ot.model.js';
import { otService } from '../services/ot.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getAllOT = async (request, response) => {
  sendSuccess(response, 200, otService.getAll(), {
    resource: 'ots',
    flow: ['mensaje -> gestion -> OT (manual)', 'crear OT', 'cambiar estado', 'matriz central'],
    model: otModel,
    repositoryMode: otService.repositoryMode,
  });
};

export const createOT = async (request, response) => {
  const item = otService.create(request.body || {});

  if (item.errors) {
    return sendError(response, 400, 'Payload de OT inválido.', {
      resource: 'ots',
      validations: item.errors,
    });
  }

  return sendSuccess(response, 201, item, {
    resource: 'ots',
    action: 'createOT',
  });
};

export const updateOTStatus = async (request, response) => {
  const result = otService.updateStatus(request.params.id, request.body?.estado, otModel.statusOptions);

  if (result.error) {
    return sendError(response, 400, result.error, {
      resource: 'ots',
      validStatuses: otModel.statusOptions,
    });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'updateOTStatus',
  });
};
