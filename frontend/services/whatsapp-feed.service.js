import { httpClient } from './http-client.js';

export const whatsappFeedService = {
  getFeed: async () => {
    const r = await httpClient.get('/whatsapp/feed');
    return r.data ?? { messages: [], ingestLogs: [], errors: [], operationalSummary: null };
  },

  /**
   * @param {object} payload - { message: rawMessage, clientList?: string[] }
   */
  ingest: async (payload) => {
    const r = await httpClient.post('/whatsapp/ingest', payload);
    return r.data;
  },
};
