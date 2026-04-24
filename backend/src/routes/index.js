import { approvalRoutes } from './approval.routes.js';
import { auditRoutes } from './audit.routes.js';
import { climaRoutes } from './clima.routes.js';
import { clientRoutes } from './client.routes.js';
import { expenseRoutes } from './expense.routes.js';
import { flotaRoutes } from './flota.routes.js';
import { gestionRoutes } from './gestion.routes.js';
import { healthRoutes } from './health.routes.js';
import { matrizRoutes } from './matriz.routes.js';
import { messageRoutes } from './message.routes.js';
import { otRoutes } from './ot.routes.js';
import { tecnicoRoutes } from './tecnico.routes.js';
import { vehicleRoutes } from './vehicle.routes.js';

export const routes = [
  ...healthRoutes,
  ...messageRoutes,
  ...tecnicoRoutes,
  ...approvalRoutes,
  ...auditRoutes,
  ...climaRoutes,
  ...flotaRoutes,
  ...gestionRoutes,
  ...otRoutes,
  ...matrizRoutes,
  ...clientRoutes,
  ...vehicleRoutes,
  ...expenseRoutes,
];
