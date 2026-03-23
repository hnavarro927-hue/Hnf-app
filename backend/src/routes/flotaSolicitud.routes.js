import {
  getFlotaSolicitudes,
  patchFlotaSolicitud,
  postFlotaSolicitud,
} from '../controllers/flotaSolicitud.controller.js';

export const flotaSolicitudRoutes = [
  { method: 'GET', path: '/flota/solicitudes', handler: getFlotaSolicitudes },
  { method: 'POST', path: '/flota/solicitudes', handler: postFlotaSolicitud },
  { method: 'PATCH', path: '/flota/solicitudes/:id', handler: patchFlotaSolicitud },
];
