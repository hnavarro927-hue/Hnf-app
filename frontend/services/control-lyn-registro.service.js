import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const controlLynRegistroService = {
  get: () => httpClient.get(apiEndpoints.controlRegistroLyn).then(data),
  patch: (body) => httpClient.patch(apiEndpoints.controlRegistroLyn, body).then(data),
};
