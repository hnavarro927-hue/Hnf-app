import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const climaService = {
  getSnapshot: () => httpClient.get(apiEndpoints.clima),
  importStores: (payload) => httpClient.post(apiEndpoints.climaStoresImport, payload),
  createCalendario: (payload) => httpClient.post(apiEndpoints.climaCalendario, payload),
  createInforme: (payload) => httpClient.post(apiEndpoints.climaInformes, payload),
  createOT: (payload) => httpClient.post(apiEndpoints.climaOTs, payload),
  updateOTStatus: (id, payload) => httpClient.patch(`${apiEndpoints.climaOTs}/${id}/status`, payload),
};
