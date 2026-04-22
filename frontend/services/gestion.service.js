import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const gestionService = {
  getAll: () => httpClient.get(apiEndpoints.gestiones),
  create: (payload) => httpClient.post(apiEndpoints.gestiones, payload),
  updateStatus: (id, payload) => httpClient.patch(`${apiEndpoints.gestiones}/${id}/status`, payload),
};
