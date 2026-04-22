import { auditService } from '../services/audit.service.js';
import { sendSuccess } from '../utils/http.js';

export const getAuditLogs = async (request, response) => {
  return sendSuccess(response, 200, auditService.getAll(), { resource: 'logs' });
};
