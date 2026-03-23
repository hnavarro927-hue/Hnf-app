import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const qs = (params = {}) => {
  const sp = new URLSearchParams();
  if (params.cliente) sp.set('cliente', params.cliente);
  if (params.estado) sp.set('estado', params.estado);
  const q = sp.toString();
  return q ? `?${q}` : '';
};

export const flotaSolicitudService = {
  getAll: (params) => httpClient.get(`${apiEndpoints.flotaSolicitudes}${qs(params)}`),
  create: (body) => httpClient.post(apiEndpoints.flotaSolicitudes, body),
  patch: (id, body) =>
    httpClient.patch(`${apiEndpoints.flotaSolicitudes}/${encodeURIComponent(id)}`, body),
};
