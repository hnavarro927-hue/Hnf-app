import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const commercialLeadsService = {
  getAll: () => httpClient.get(apiEndpoints.commercialLeads).then(data),
  create: (body) => httpClient.post(apiEndpoints.commercialLeads, body).then(data),
  patch: (id, body) =>
    httpClient.patch(`${apiEndpoints.commercialLeads}/${encodeURIComponent(id)}`, body).then(data),
  postInteraccion: (id, body) =>
    httpClient
      .post(`${apiEndpoints.commercialLeads}/${encodeURIComponent(id)}/interaccion`, body || {})
      .then(data),
  convertirOt: (id) =>
    httpClient
      .post(`${apiEndpoints.commercialLeads}/${encodeURIComponent(id)}/convertir-ot`, {})
      .then(data),
};
