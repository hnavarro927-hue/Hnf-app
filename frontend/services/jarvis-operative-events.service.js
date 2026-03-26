import { httpClient } from './http-client.js';

export const jarvisOperativeEventsService = {
  async getAll() {
    return httpClient.get('/jarvis-operative-events');
  },

  /** @param {object} payload */
  async append(payload) {
    return httpClient.post('/jarvis-operative-events', payload);
  },
};
