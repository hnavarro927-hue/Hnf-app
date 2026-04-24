import { createFlotaGestion, createFlotaOT, createFlotaVehiculo, getFlotaSnapshot, updateFlotaOTStatus } from '../controllers/flota.controller.js';

export const flotaRoutes = [
  { method: 'GET', path: '/flota', handler: getFlotaSnapshot },
  { method: 'POST', path: '/flota/vehiculos', handler: createFlotaVehiculo },
  { method: 'POST', path: '/flota/gestion', handler: createFlotaGestion },
  { method: 'POST', path: '/flota/ots', handler: createFlotaOT },
  { method: 'PATCH', path: '/flota/ots/:id/status', handler: updateFlotaOTStatus },
];
