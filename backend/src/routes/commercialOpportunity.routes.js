import {
  getCommercialOpportunities,
  patchCommercialOpportunityStatusById,
} from '../controllers/commercialOpportunity.controller.js';

export const commercialOpportunityRoutes = [
  { method: 'GET', path: 'commercial-opportunities', handler: getCommercialOpportunities },
  {
    method: 'PATCH',
    path: 'commercial-opportunities/:id/status',
    handler: patchCommercialOpportunityStatusById,
  },
];
