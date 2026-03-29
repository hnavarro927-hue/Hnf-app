import { buildMePayload } from '../services/auth.service.js';
import { auditService } from '../services/audit.service.js';
import { assertAction } from '../utils/rbacHttp.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getRbacMe = async (request, response) => {
  const payload = buildMePayload(request.hnfAuth);
  sendSuccess(response, 200, payload, { resource: 'rbac/me' });
};

export const getAuditRecent = async (request, response) => {
  const ctx = assertAction(request, response, 'audit.read');
  if (!ctx) return;
  try {
    const u = new URL(request.url || '', 'http://localhost');
    const lim = Number(u.searchParams.get('limit') || '80');
    const data = await auditService.recent(Number.isFinite(lim) ? lim : 80);
    sendSuccess(response, 200, data, { resource: 'audit' });
  } catch {
    sendError(response, 500, 'No se pudo leer auditoría');
  }
};
