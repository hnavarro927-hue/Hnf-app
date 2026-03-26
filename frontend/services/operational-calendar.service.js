import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

export const operationalCalendarService = {
  /**
   * @param {{ desde: string, hasta: string }} range - YYYY-MM-DD
   */
  getMerged: async ({ desde, hasta }) => {
    const r = await httpClient.get(
      `${apiEndpoints.operationalCalendar}?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`
    );
    return r.data;
  },

  create: (body) => httpClient.post(apiEndpoints.operationalCalendar, body),

  patch: (id, body) =>
    httpClient.patch(`${apiEndpoints.operationalCalendar}/${encodeURIComponent(id)}`, body),
};
