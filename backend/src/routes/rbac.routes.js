import { getAuditRecent, getRbacMe } from '../controllers/rbac.controller.js';

export const rbacRoutes = [
  { method: 'GET', path: '/rbac/me', handler: getRbacMe },
  { method: 'GET', path: '/audit/recent', handler: getAuditRecent },
];
