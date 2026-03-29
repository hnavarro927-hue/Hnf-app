import {
  ACTION_ACCESS,
  MODULE_ACCESS,
  resolveRbacRole,
  roleCanPerformAction,
} from '../config/rbac.config.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';
import { assertAction } from '../utils/rbacHttp.js';

export const getRbacMe = async (request, response) => {
  const actor = getRequestActor(request);
  const role = resolveRbacRole(actor);
  const actions = Object.fromEntries(
    Object.keys(ACTION_ACCESS).map((a) => [a, roleCanPerformAction(role, a)])
  );
  const modules = MODULE_ACCESS[role] || MODULE_ACCESS.admin;
  sendSuccess(response, 200, { actor, role, modules, actions }, { resource: 'rbac/me' });
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
