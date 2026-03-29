import { resolveRbacRole, roleCanPerformAction } from '../config/rbac.config.js';
import { sendError } from './http.js';
import { getRequestActor } from './requestActor.js';

/**
 * @returns {{ actor: string, role: string } | null}
 */
export function assertAction(request, response, action) {
  const actor = getRequestActor(request);
  const role = resolveRbacRole(actor);
  if (!roleCanPerformAction(role, action)) {
    sendError(response, 403, 'Sin permiso para esta acción.', { action, role });
    return null;
  }
  return { actor, role };
}
