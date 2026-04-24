import { createGestion, getAllGestiones, updateGestionStatus } from '../controllers/gestion.controller.js';

export const gestionRoutes = [
  { method: 'GET', path: '/gestiones', handler: getAllGestiones },
  { method: 'POST', path: '/gestiones', handler: createGestion },
  { method: 'PATCH', path: '/gestiones/:id/status', handler: updateGestionStatus },
];
