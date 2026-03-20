import { createOT, getAllOT, updateOTStatus } from '../controllers/ot.controller.js';

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
];
