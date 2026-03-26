import {
  getOperationalEvents,
  getOperationalEventInforme,
  getOperationalPanelDaily,
  patchOperationalEventEstado,
  postOperationalEventManual,
} from '../controllers/operationalEvent.controller.js';
import { postOperationalIngest } from '../controllers/operationalIngest.controller.js';

export const operationalEventRoutes = [
  { method: 'GET', path: '/operational-events', handler: getOperationalEvents },
  { method: 'POST', path: '/operational-events', handler: postOperationalEventManual },
  {
    method: 'PATCH',
    path: '/operational-events/:id/estado',
    handler: patchOperationalEventEstado,
  },
  {
    method: 'GET',
    path: '/operational-events/:id/informe-interno',
    handler: getOperationalEventInforme,
  },
  { method: 'GET', path: '/operational-panel/daily', handler: getOperationalPanelDaily },
  { method: 'POST', path: '/operational-ingest', handler: postOperationalIngest },
];
