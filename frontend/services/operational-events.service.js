import { httpClient } from './http-client.js';

const unwrap = (r) => (r && r.success ? r.data : null);

export const operationalEventsService = {
  async listEvents() {
    const r = await httpClient.get('/operational-events').catch(() => null);
    return unwrap(r)?.events ?? [];
  },

  async getDailyPanel() {
    const r = await httpClient.get('/operational-panel/daily').catch(() => null);
    return unwrap(r)?.panel ?? null;
  },

  /** @param {object} body */
  async createManual(body) {
    return httpClient.post('/operational-events', body).catch((e) => {
      console.warn('[HNF] operational-events create', e);
      return null;
    });
  },

  /** @param {string} id @param {{ estado: string, nota?: string }} body */
  async patchEstado(id, body) {
    return httpClient.patch(`/operational-events/${encodeURIComponent(id)}/estado`, body).catch((e) => {
      console.warn('[HNF] operational-events estado', e);
      return null;
    });
  },
};
