import {
  getSystemUsers,
  patchSystemUser,
  patchSystemUserEstado,
  patchSystemUserPasswordReset,
  postSystemUser,
} from '../controllers/systemUser.controller.js';

export const systemUserRoutes = [
  { method: 'GET', path: '/usuarios', handler: getSystemUsers },
  { method: 'POST', path: '/usuarios', handler: postSystemUser },
  { method: 'PATCH', path: '/usuarios/:id', handler: patchSystemUser },
  { method: 'PATCH', path: '/usuarios/:id/estado', handler: patchSystemUserEstado },
  { method: 'PATCH', path: '/usuarios/:id/password-reset', handler: patchSystemUserPasswordReset },
];
