import {
  createOT,
  getAllOT,
  patchOTEvidences,
  patchOTEquipos,
  patchOTReport,
  patchOTVisit,
  patchOTEconomics,
  patchOTOperational,
  updateOTStatus,
} from '../controllers/ot.controller.js';

export const otRoutes = [
  {
    method: 'GET',
    path: '/ots',
    handler: getAllOT,
  },
  {
    method: 'POST',
    path: '/ots',
    handler: createOT,
  },
  {
    method: 'PATCH',
    path: '/ots/:id/status',
    handler: updateOTStatus,
  },
  {
    method: 'PATCH',
    path: '/ots/:id/evidences',
    handler: patchOTEvidences,
  },
  {
    method: 'PATCH',
    path: '/ots/:id/equipos',
    handler: patchOTEquipos,
  },
  {
    method: 'PATCH',
    path: '/ots/:id/report',
    handler: patchOTReport,
  },
  {
    method: 'PATCH',
    path: '/ots/:id/visit',
    handler: patchOTVisit,
  },
  {
    method: 'PATCH',
    path: '/ots/:id/economics',
    handler: patchOTEconomics,
  },
  {
    method: 'PATCH',
    path: '/ots/:id/operacion',
    handler: patchOTOperational,
  },
];
