import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const clientService = {
  getAll: () => httpClient.get(apiEndpoints.clients),
};
