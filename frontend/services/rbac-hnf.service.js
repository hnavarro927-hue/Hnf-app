import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const rbacHnfService = {
  me: () => httpClient.get(apiEndpoints.rbacMe).then(data),
  auditRecent: (limit = 80) =>
    httpClient.get(`${apiEndpoints.auditRecent}?limit=${encodeURIComponent(limit)}`).then(data),
};
