import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

export const lynOtAprobacionService = {
  cola: (filtro = 'activas_lyn') =>
    httpClient
      .get(`${apiEndpoints.otsLynAprobacionCola}?filtro=${encodeURIComponent(filtro)}`)
      .then(unwrap),
  aplicar: (otId, body) =>
    httpClient
      .patch(`${apiEndpoints.ots}/${encodeURIComponent(otId)}/lyn-aprobacion`, body)
      .then(unwrap),
};
