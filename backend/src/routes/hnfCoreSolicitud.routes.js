import {
  getHnfCoreSolicitudById,
  getHnfCoreSolicitudes,
  patchHnfCoreSolicitud,
  postHnfCoreSolicitud,
} from '../controllers/hnfCoreSolicitud.controller.js';

export const hnfCoreSolicitudRoutes = [
  { method: 'GET', path: '/hnf-core/solicitudes', handler: getHnfCoreSolicitudes },
  { method: 'GET', path: '/hnf-core/solicitudes/:id', handler: getHnfCoreSolicitudById },
  { method: 'POST', path: '/hnf-core/solicitudes', handler: postHnfCoreSolicitud },
  { method: 'PATCH', path: '/hnf-core/solicitudes/:id', handler: patchHnfCoreSolicitud },
];
