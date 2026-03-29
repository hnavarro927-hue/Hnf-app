import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const operativoBandejaService = {
  crearOtDesdeDocumento: (documento_id) =>
    httpClient.post(apiEndpoints.operativoCrearOtDesdeDocumento, { documento_id }).then(data),

  asignarDocumento: (body) => httpClient.patch(apiEndpoints.operativoAsignar, body).then(data),

  marcarGestionado: (documento_id) =>
    httpClient.post(apiEndpoints.operativoMarcarGestionado, { documento_id }).then(data),
};
