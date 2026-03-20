import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const vehicleService = {
  getAll: () => httpClient.get(apiEndpoints.vehicles),
};
