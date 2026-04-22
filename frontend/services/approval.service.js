import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const approvalService = {
  getAll: () => httpClient.get(apiEndpoints.approvals),
  decide: (id, payload) => httpClient.patch(`${apiEndpoints.approvals}/${id}/decidir`, payload),
};
