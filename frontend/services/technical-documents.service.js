import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const unwrapList = (r) => {
  const d = r?.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  return [];
};

export const technicalDocumentsService = {
  getAll: async () => {
    const r = await httpClient.get(apiEndpoints.technicalDocuments);
    return unwrapList(r);
  },

  getById: async (id) => {
    const r = await httpClient.get(`${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}`);
    return r.data;
  },

  create: (body) => httpClient.post(apiEndpoints.technicalDocuments, body),

  patch: (id, body) =>
    httpClient.patch(`${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}`, body),

  addComment: (id, body) =>
    httpClient.post(`${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}/comments`, body),

  addIngesta: (id, body) =>
    httpClient.post(`${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}/ingesta`, body),

  ingest: (body) => httpClient.post(`${apiEndpoints.technicalDocuments}/ingest`, body),

  revisar: (id, body) =>
    httpClient.patch(
      `${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}/revisar`,
      body || {}
    ),

  observar: (id, body) =>
    httpClient.patch(
      `${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}/observar`,
      body || {}
    ),

  aprobar: (id, body) =>
    httpClient.patch(
      `${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}/aprobar`,
      body || {}
    ),

  enviar: (id, body) =>
    httpClient.patch(
      `${apiEndpoints.technicalDocuments}/${encodeURIComponent(id)}/enviar`,
      body || {}
    ),
};
