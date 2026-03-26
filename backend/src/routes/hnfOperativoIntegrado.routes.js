import {
  getExtendedClients,
  getInternalDirectory,
  getValidatedMemory,
  getValidationQueue,
  patchExtendedClient,
  patchInternalDirectory,
  patchValidationQueue,
  postCargaMasiva,
  postExtendedClient,
  postInternalDirectory,
  postValidationConfirm,
  postValidationQueue,
} from '../controllers/hnfOperativoIntegrado.controller.js';

export const hnfOperativoIntegradoRoutes = [
  { method: 'GET', path: '/hnf-core/validation-queue', handler: getValidationQueue },
  { method: 'POST', path: '/hnf-core/validation-queue', handler: postValidationQueue },
  { method: 'PATCH', path: '/hnf-core/validation-queue/:id', handler: patchValidationQueue },
  { method: 'POST', path: '/hnf-core/validation-queue/:id/confirm', handler: postValidationConfirm },
  { method: 'POST', path: '/hnf-core/carga-masiva', handler: postCargaMasiva },
  { method: 'GET', path: '/hnf-core/validated-memory', handler: getValidatedMemory },
  { method: 'GET', path: '/hnf-core/extended-clients', handler: getExtendedClients },
  { method: 'POST', path: '/hnf-core/extended-clients', handler: postExtendedClient },
  { method: 'PATCH', path: '/hnf-core/extended-clients/:id', handler: patchExtendedClient },
  { method: 'GET', path: '/hnf-core/internal-directory', handler: getInternalDirectory },
  { method: 'POST', path: '/hnf-core/internal-directory', handler: postInternalDirectory },
  { method: 'PATCH', path: '/hnf-core/internal-directory/:id', handler: patchInternalDirectory },
];
