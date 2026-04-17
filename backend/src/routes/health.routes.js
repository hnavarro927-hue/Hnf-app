import { apiHealthPing, healthcheck } from '../controllers/health.controller.js';

export const healthRoutes = [
  {
    method: 'GET',
    path: '/api/health',
    handler: apiHealthPing,
  },
  {
    method: 'GET',
    path: '/health',
    handler: healthcheck,
  },
];
