import { createApproval, decideApproval, getApprovals } from '../controllers/approval.controller.js';

export const approvalRoutes = [
  { method: 'GET', path: '/aprobaciones', handler: getApprovals },
  { method: 'POST', path: '/aprobaciones', handler: createApproval },
  { method: 'PATCH', path: '/aprobaciones/:id/decidir', handler: decideApproval },
];
