import {
  getCommercialBorradoresCorreo,
  getCommercialPropuestas,
  patchCommercialPropuesta,
  postCommercialBorradorJarvis,
  postCommercialPropuesta,
} from '../controllers/commercialWorkspace.controller.js';

export const commercialWorkspaceRoutes = [
  { method: 'GET', path: '/commercial/propuestas', handler: getCommercialPropuestas },
  { method: 'POST', path: '/commercial/propuestas', handler: postCommercialPropuesta },
  { method: 'PATCH', path: '/commercial/propuestas/:id', handler: patchCommercialPropuesta },
  { method: 'GET', path: '/commercial/borradores-correo', handler: getCommercialBorradoresCorreo },
  { method: 'POST', path: '/commercial/borradores-correo/jarvis', handler: postCommercialBorradorJarvis },
];
