import {
  getCommercialLeads,
  patchCommercialLead,
  postCommercialLead,
  postCommercialLeadConvertirOt,
  postCommercialLeadInteraccion,
} from '../controllers/commercialLead.controller.js';

export const commercialLeadRoutes = [
  { method: 'GET', path: '/commercial-leads', handler: getCommercialLeads },
  { method: 'POST', path: '/commercial-leads', handler: postCommercialLead },
  { method: 'PATCH', path: '/commercial-leads/:id', handler: patchCommercialLead },
  { method: 'POST', path: '/commercial-leads/:id/interaccion', handler: postCommercialLeadInteraccion },
  { method: 'POST', path: '/commercial-leads/:id/convertir-ot', handler: postCommercialLeadConvertirOt },
];
