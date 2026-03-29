import {
  patchOperativoAsignar,
  postOperativoCrearOtDesdeDocumento,
  postOperativoMarcarGestionado,
} from '../controllers/operativoBandeja.controller.js';

export const operativoBandejaRoutes = [
  { method: 'POST', path: '/operativo/crear-ot-desde-documento', handler: postOperativoCrearOtDesdeDocumento },
  { method: 'PATCH', path: '/operativo/asignar', handler: patchOperativoAsignar },
  { method: 'POST', path: '/operativo/marcar-gestionado', handler: postOperativoMarcarGestionado },
];
