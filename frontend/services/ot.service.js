import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

export const otService = {
  getAll: () => httpClient.get(apiEndpoints.ots),
  getById: (id) => httpClient.get(`${apiEndpoints.ots}/${encodeURIComponent(id)}`).then(unwrap),
  create: (payload) => httpClient.post(apiEndpoints.ots, payload),
  patchCore: (id, payload) =>
    httpClient.patch(`${apiEndpoints.ots}/${encodeURIComponent(id)}`, payload),
  delete: (id) => httpClient.delete(`${apiEndpoints.ots}/${encodeURIComponent(id)}`),
  updateStatus: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/status`, payload),
  patchEvidences: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/evidences`, payload),
  patchReport: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/report`, payload),
  patchEquipos: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/equipos`, payload),
  patchVisit: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${encodeURIComponent(id)}/visit`, payload),
  patchEconomics: (id, payload) =>
    httpClient.patch(`${apiEndpoints.ots}/${encodeURIComponent(id)}/economics`, payload),
  patchOperational: (id, payload) =>
    httpClient.patch(`${apiEndpoints.ots}/${encodeURIComponent(id)}/operacion`, payload),
};
