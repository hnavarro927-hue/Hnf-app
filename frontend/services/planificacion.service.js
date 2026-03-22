import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const qs = (params = {}) => {
  const sp = new URLSearchParams();
  if (params.clienteId) sp.set('clienteId', params.clienteId);
  if (params.fecha) sp.set('fecha', params.fecha);
  if (params.tecnico) sp.set('tecnico', params.tecnico);
  const q = sp.toString();
  return q ? `?${q}` : '';
};

export const planificacionService = {
  getClientes: () => httpClient.get(apiEndpoints.planClientes),
  postCliente: (body) => httpClient.post(apiEndpoints.planClientes, body),
  getTiendas: (params) => httpClient.get(`${apiEndpoints.planTiendas}${qs(params)}`),
  postTienda: (body) => httpClient.post(apiEndpoints.planTiendas, body),
  getMantenciones: (params) => httpClient.get(`${apiEndpoints.planMantenciones}${qs(params)}`),
  postMantencion: (body) => httpClient.post(apiEndpoints.planMantenciones, body),
  patchMantencion: (id, body) =>
    httpClient.patch(`${apiEndpoints.planMantenciones}/${encodeURIComponent(id)}`, body),
};
