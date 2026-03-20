import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const expenseService = {
  getAll: () => httpClient.get(apiEndpoints.expenses),
  getById: (id) => httpClient.get(`${apiEndpoints.expenses}/${id}`),
  create: (payload) => httpClient.post(apiEndpoints.expenses, payload),
};
