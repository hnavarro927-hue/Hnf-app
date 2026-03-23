import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const otService = {
  getAll: () => httpClient.get(apiEndpoints.ots),
  create: (payload) => httpClient.post(apiEndpoints.ots, payload),
  updateStatus: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/status`, payload),
  patchEvidences: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/evidences`, payload),
  patchReport: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/report`, payload),
  patchEquipos: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${id}/equipos`, payload),
  patchVisit: (id, payload) => httpClient.patch(`${apiEndpoints.ots}/${encodeURIComponent(id)}/visit`, payload),
  patchEconomics: (id, payload) =>
    httpClient.patch(`${apiEndpoints.ots}/${encodeURIComponent(id)}/economics`, payload),
};
