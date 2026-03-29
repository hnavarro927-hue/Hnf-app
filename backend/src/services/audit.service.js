import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { resolveRbacRole } from '../config/rbac.config.js';

export const auditService = {
  async logCritical({ actor, action, resource, resourceId, meta, result }) {
    const role = resolveRbacRole(actor);
    return auditLogRepository.append({
      actor: String(actor || 'sistema').slice(0, 120),
      role,
      action: String(action || '').slice(0, 120),
      resource: resource ? String(resource).slice(0, 80) : null,
      resourceId: resourceId ? String(resourceId).slice(0, 80) : null,
      result: result ? String(result).slice(0, 40) : 'ok',
      meta:
        meta && typeof meta === 'object'
          ? JSON.stringify(meta).slice(0, 2000)
          : meta != null
            ? String(meta).slice(0, 500)
            : null,
    });
  },

  async recent(limit) {
    return auditLogRepository.findRecent(limit);
  },
};
