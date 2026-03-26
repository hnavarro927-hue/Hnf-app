import { getResponsibility, patchResponsibilityTask } from '../controllers/responsibility.controller.js';

export const responsibilityRoutes = [
  {
    method: 'GET',
    path: '/api/responsibility',
    handler: getResponsibility,
  },
  {
    method: 'PATCH',
    path: '/api/responsibility/tasks/:id',
    handler: patchResponsibilityTask,
  },
];
