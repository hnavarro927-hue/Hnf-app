import { getAuthMe, postAuthLogin, postAuthLogout } from '../controllers/auth.controller.js';

export const authRoutes = [
  { method: 'POST', path: '/auth/login', handler: postAuthLogin },
  { method: 'POST', path: '/auth/logout', handler: postAuthLogout },
  { method: 'GET', path: '/auth/me', handler: getAuthMe },
];
