import { listClients } from '../controllers/client.controller.js';

export const clientRoutes = [
  {
    method: 'GET',
    path: '/clients',
    handler: listClients,
  },
];
