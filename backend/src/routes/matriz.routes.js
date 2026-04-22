import { getAllMatriz } from '../controllers/matriz.controller.js';

export const matrizRoutes = [
  { method: 'GET', path: '/matriz', handler: getAllMatriz },
];
