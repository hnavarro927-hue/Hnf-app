import { getControlRegistroLyn, patchControlRegistroLyn } from '../controllers/controlLyn.controller.js';

export const controlLynRoutes = [
  { method: 'GET', path: '/control/registro-lyn', handler: getControlRegistroLyn },
  { method: 'PATCH', path: '/control/registro-lyn', handler: patchControlRegistroLyn },
];
