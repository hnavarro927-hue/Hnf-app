import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const qs = (params = {}) => {
  const sp = new URLSearchParams();
  if (params.tipo) sp.set('tipo', params.tipo);
  if (params.estado) sp.set('estado', params.estado);
  if (params.origen) sp.set('origen', params.origen);
  if (params.responsable) sp.set('responsable', params.responsable);
  if (params.inbox) sp.set('inbox', params.inbox);
  const q = sp.toString();
  return q ? `?${q}` : '';
};

const unwrap = (res) => (res && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : []);

export const hnfCoreSolicitudesService = {
  getAll: async (params) => {
    const res = await httpClient.get(`${apiEndpoints.hnfCoreSolicitudes}${qs(params)}`);
    return unwrap(res);
  },
  create: (body) => httpClient.post(apiEndpoints.hnfCoreSolicitudes, body),
  patch: (id, body) =>
    httpClient.patch(`${apiEndpoints.hnfCoreSolicitudes}/${encodeURIComponent(id)}`, body),
};
