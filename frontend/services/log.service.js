import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const logService = {
  getAll: () => httpClient.get(apiEndpoints.logs),
};
