import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const flotaService = {
  getSnapshot: () => httpClient.get(apiEndpoints.flota),
  createVehiculo: (payload) => httpClient.post(apiEndpoints.flotaVehiculos, payload),
  createGestion: (payload) => httpClient.post(apiEndpoints.flotaGestion, payload),
  createOT: (payload) => httpClient.post(apiEndpoints.flotaOTs, payload),
  updateOTStatus: (id, payload) => httpClient.patch(`${apiEndpoints.flotaOTs}/${id}/status`, payload),
};
