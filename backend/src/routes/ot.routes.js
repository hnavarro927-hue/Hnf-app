import {
  createOT,
  getAllOT,
  patchOTEvidences,
  patchOTEquipos,
  patchOTReport,
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
];
