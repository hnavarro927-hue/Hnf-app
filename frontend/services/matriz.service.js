import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const matrizService = {
  getAll: () => httpClient.get(apiEndpoints.matriz),
};
