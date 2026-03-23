import { clientRoutes } from './client.routes.js';
import { expenseRoutes } from './expense.routes.js';
import { flotaSolicitudRoutes } from './flotaSolicitud.routes.js';
import { healthRoutes } from './health.routes.js';
import { otRoutes } from './ot.routes.js';
import { planificacionRoutes } from './planificacion.routes.js';
import { vehicleRoutes } from './vehicle.routes.js';

export const routes = [
  ...healthRoutes,
  ...otRoutes,
  ...clientRoutes,
  ...vehicleRoutes,
  ...expenseRoutes,
  ...planificacionRoutes,
  ...flotaSolicitudRoutes,
];
