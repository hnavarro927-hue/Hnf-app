import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const unwrapList = (r) => {
  const d = r?.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  return [];
};

export const commercialOpportunitiesService = {
  getAll: async () => {
    const r = await httpClient.get(apiEndpoints.commercialOpportunities);
    return unwrapList(r);
  },

  patchStatus: (id, body) =>
    httpClient.patch(
      `${apiEndpoints.commercialOpportunities}/${encodeURIComponent(id)}/status`,
      body || {}
    ),
};
