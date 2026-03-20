import { healthcheck } from '../controllers/health.controller.js';

export const healthRoutes = [
  {
    method: 'GET',
    path: '/health',
    handler: healthcheck,
  },
];
