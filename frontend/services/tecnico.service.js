import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const tecnicoService = {
  getAll: () => httpClient.get(apiEndpoints.tecnicos),
};
