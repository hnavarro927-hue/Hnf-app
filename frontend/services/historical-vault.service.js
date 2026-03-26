import { httpClient } from './http-client.js';

const unwrap = (r) => r?.data ?? r;

export const historicalVaultService = {
  getVault: async () => {
    try {
      const r = await httpClient.get('/historical-vault');
      return unwrap(r);
    } catch {
      return { records: [], importBatches: [], computed: null };
    }
  },

  ingestBatch: async (payload) => {
    const r = await httpClient.post('/historical-vault/ingest', { payload });
    return unwrap(r);
  },

  search: async (query) => {
    const r = await httpClient.post('/historical-vault/search', { query });
    return unwrap(r);
  },

  getTimeline: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const r = await httpClient.get(`/historical-vault/timeline${q ? `?${q}` : ''}`);
    return unwrap(r);
  },

  getPatterns: async () => {
    const r = await httpClient.get('/historical-vault/patterns');
    return unwrap(r);
  },

  getAssets: async () => {
    const r = await httpClient.get('/historical-vault/assets');
    return unwrap(r);
  },
};
