import { messageModel } from '../models/message.model.js';
import { messageService } from '../services/message.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getAllMessages = async (request, response) => {
  sendSuccess(response, 200, messageService.getAll(), {
    resource: 'messages',
    model: messageModel,
    repositoryMode: messageService.repositoryMode,
  });
};

export const createMessage = async (request, response) => {
  const item = messageService.create(request.body || {});
  if (item.errors) {
    return sendError(response, 400, 'Payload de mensaje inválido.', { validations: item.errors });
  }

  return sendSuccess(response, 201, item, { resource: 'messages', action: 'createMessage' });
};

export const reviewMessageByGery = async (request, response) => {
  const row = messageService.reviewByGery(request.params.id, request.body || {});
  if (row.error) return sendError(response, 400, row.error);
  return sendSuccess(response, 200, row, { action: 'reviewed_by_gery' });
};

export const approveMessageByLyn = async (request, response) => {
  const row = messageService.approveByLyn(request.params.id, request.body || {});
  if (row.error) return sendError(response, 400, row.error);
  return sendSuccess(response, 200, row, { action: 'approved_by_lyn' });
};

export const updateMessageStatus = async (request, response) => {
  const result = messageService.markTransition(request.params.id, request.body?.estado, request.body?.actor);
  if (result.error) return sendError(response, 400, result.error, { validStatuses: messageModel.statusOptions });
  return sendSuccess(response, 200, result, { resource: 'messages', action: 'updateMessageStatus' });
};
