import { createTecnico, getTecnicos } from '../controllers/tecnico.controller.js';

export const tecnicoRoutes = [
  { method: 'GET', path: '/tecnicos', handler: getTecnicos },
  { method: 'POST', path: '/tecnicos', handler: createTecnico },
];
