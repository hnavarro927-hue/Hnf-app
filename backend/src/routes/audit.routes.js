import { getAuditLogs } from '../controllers/audit.controller.js';

export const auditRoutes = [
  { method: 'GET', path: '/logs', handler: getAuditLogs },
];
