import { approvalService } from '../services/approval.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getApprovals = async (request, response) => sendSuccess(response, 200, approvalService.getAll(), { resource: 'aprobaciones' });

export const createApproval = async (request, response) => sendSuccess(response, 201, approvalService.requestApproval(request.body || {}), { resource: 'aprobaciones' });

export const decideApproval = async (request, response) => {
  const row = approvalService.decide(request.params.id, request.body || {});
  if (row.error) return sendError(response, 400, row.error);
  return sendSuccess(response, 200, row, { resource: 'aprobaciones' });
};
