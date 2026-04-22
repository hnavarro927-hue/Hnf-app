import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const messageService = {
  getAll: () => httpClient.get(apiEndpoints.messages),
  create: (payload) => httpClient.post(apiEndpoints.messages, payload),
  reviewByGery: (id, payload) => httpClient.patch(`${apiEndpoints.messages}/${id}/review`, payload),
  approveByLyn: (id, payload) => httpClient.patch(`${apiEndpoints.messages}/${id}/approve`, payload),
  updateStatus: (id, payload) => httpClient.patch(`${apiEndpoints.messages}/${id}/status`, payload),
};
