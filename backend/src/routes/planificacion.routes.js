import {
  getPlanClientes,
  getPlanMantenciones,
  getPlanTiendas,
  patchPlanMantencion,
  postPlanCliente,
  postPlanMantencion,
  postPlanTienda,
} from '../controllers/planificacion.controller.js';

export const planificacionRoutes = [
  { method: 'GET', path: '/clientes', handler: getPlanClientes },
  { method: 'POST', path: '/clientes', handler: postPlanCliente },
  { method: 'GET', path: '/tiendas', handler: getPlanTiendas },
  { method: 'POST', path: '/tiendas', handler: postPlanTienda },
  { method: 'GET', path: '/mantenciones', handler: getPlanMantenciones },
  { method: 'POST', path: '/mantenciones', handler: postPlanMantencion },
  { method: 'PATCH', path: '/mantenciones/:id', handler: patchPlanMantencion },
];
