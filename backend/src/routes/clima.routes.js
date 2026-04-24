import { createClimaCalendario, createClimaInforme, createClimaOT, getClimaSnapshot, importPumaStores, requestClimaApproval, updateClimaOTStatus } from '../controllers/clima.controller.js';

export const climaRoutes = [
  { method: 'GET', path: '/clima', handler: getClimaSnapshot },
  { method: 'POST', path: '/clima/tiendas/import', handler: importPumaStores },
  { method: 'POST', path: '/clima/calendario', handler: createClimaCalendario },
  { method: 'POST', path: '/clima/informes', handler: createClimaInforme },
  { method: 'POST', path: '/clima/ots', handler: createClimaOT },
  { method: 'PATCH', path: '/clima/ots/:id/status', handler: updateClimaOTStatus },
  { method: 'POST', path: '/clima/ots/:id/approval-request', handler: requestClimaApproval },
];
