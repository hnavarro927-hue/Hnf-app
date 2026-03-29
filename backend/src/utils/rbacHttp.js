import { resolveRbacRole, roleCanPerformAction } from '../config/rbac.config.js';
import { sendError } from './http.js';
import { getRequestActor } from './requestActor.js';

export function getEffectiveRole(request) {
  const r = request?.hnfAuth?.role;
  if (r) return r;
  return resolveRbacRole(getRequestActor(request));
}

/**
 * @returns {{ actor: string, role: string } | null}
 */
export function assertAction(request, response, action) {
  const actor = request?.hnfActor || getRequestActor(request);
  const role = getEffectiveRole(request);
  if (!roleCanPerformAction(role, action)) {
    sendError(response, 403, 'Sin permiso para esta acción.', { action, role });
    return null;
  }
  return { actor, role };
}
