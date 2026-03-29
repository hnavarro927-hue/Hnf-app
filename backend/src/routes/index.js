import { clientRoutes } from './client.routes.js';
import { expenseRoutes } from './expense.routes.js';
import { flotaSolicitudRoutes } from './flotaSolicitud.routes.js';
import { healthRoutes } from './health.routes.js';
import { whatsappFeedRoutes } from './whatsappFeed.routes.js';
import { outlookIntakeRoutes } from './outlookIntake.routes.js';
import { historicalVaultRoutes } from './historicalVault.routes.js';
import { jarvisOperativeEventsRoutes } from './jarvisOperativeEvents.routes.js';
import { jarvisIntakeRoutes } from './jarvisIntake.routes.js';
import { operationalEventRoutes } from './operationalEvent.routes.js';
import { otRoutes } from './ot.routes.js';
import { operationalCalendarRoutes } from './operationalCalendar.routes.js';
import { commercialOpportunityRoutes } from './commercialOpportunity.routes.js';
import { technicalDocumentRoutes } from './technicalDocument.routes.js';
import { planificacionRoutes } from './planificacion.routes.js';
import { responsibilityRoutes } from './responsibility.routes.js';
import { vehicleRoutes } from './vehicle.routes.js';
import { hnfCoreSolicitudRoutes } from './hnfCoreSolicitud.routes.js';
import { hnfOperativoIntegradoRoutes } from './hnfOperativoIntegrado.routes.js';
import { maestroRoutes } from './maestro.routes.js';

export const routes = [
  ...healthRoutes,
  ...responsibilityRoutes,
  ...otRoutes,
  ...clientRoutes,
  ...vehicleRoutes,
  ...expenseRoutes,
  ...planificacionRoutes,
  ...operationalCalendarRoutes,
  ...technicalDocumentRoutes,
  ...commercialOpportunityRoutes,
  ...flotaSolicitudRoutes,
  ...whatsappFeedRoutes,
  ...outlookIntakeRoutes,
  ...historicalVaultRoutes,
  ...jarvisOperativeEventsRoutes,
  ...jarvisIntakeRoutes,
  ...operationalEventRoutes,
  ...hnfCoreSolicitudRoutes,
  ...hnfOperativoIntegradoRoutes,
  ...maestroRoutes,
];
