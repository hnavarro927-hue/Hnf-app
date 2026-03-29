import { commercialLeadService } from '../services/commercialLead.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const getCommercialLeads = async (_request, response) => {
  const data = await commercialLeadService.list();
  sendSuccess(response, 200, data, { resource: 'commercial-leads' });
};

export const postCommercialLead = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await commercialLeadService.createManual(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r.lead, { resource: 'commercial-leads', action: 'create' });
};

export const patchCommercialLead = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await commercialLeadService.patch(request.params?.id, request.body || {}, actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r.lead, { resource: 'commercial-leads', action: 'patch' });
};

export const postCommercialLeadInteraccion = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await commercialLeadService.registrarInteraccion(request.params?.id, request.body || {}, actor);
  if (r.error) return sendError(response, 404, r.error);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 200, r.lead, { resource: 'commercial-leads', action: 'interaccion' });
};

export const postCommercialLeadConvertirOt = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await commercialLeadService.convertirAOt(request.params?.id, actor);
  if (r.error) return sendError(response, 404, r.error);
  if (r.errors) return sendError(response, 400, 'No se pudo crear OT', { validations: r.errors });
  sendSuccess(response, 201, { lead: r.lead, ot: r.ot }, { resource: 'commercial-leads', action: 'convertir_ot' });
};
