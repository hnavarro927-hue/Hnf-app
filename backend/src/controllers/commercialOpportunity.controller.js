import {
  listCommercialOpportunities,
  patchCommercialOpportunityStatus,
} from '../services/commercialOpportunity.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const getCommercialOpportunities = async (_request, response) => {
  const data = await listCommercialOpportunities();
  sendSuccess(response, 200, { items: data }, { resource: 'commercial_opportunities' });
};

export const patchCommercialOpportunityStatusById = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await patchCommercialOpportunityStatus(id, request.body || {}, actor);
  if (result.error) return sendError(response, 400, result.error, { resource: 'commercial_opportunities' });
  sendSuccess(response, 200, result.entry, { resource: 'commercial_opportunities', action: 'status' });
};
