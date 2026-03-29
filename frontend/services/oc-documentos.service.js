import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const ocDocumentosService = {
  list: () => httpClient.get(apiEndpoints.documentosOc).then(data),
  get: (id) => httpClient.get(`${apiEndpoints.documentosOc}/${encodeURIComponent(id)}`).then(data),
  uploadPdf: (body) => httpClient.post(apiEndpoints.documentosOcCargaPdf, body).then(data),
  patchCabecera: (id, body) =>
    httpClient.patch(`${apiEndpoints.documentosOc}/${encodeURIComponent(id)}/cabecera`, body).then(data),
  patchDetalle: (detalleId, body) =>
    httpClient.patch(`${apiEndpoints.documentosOc}/detalle/${encodeURIComponent(detalleId)}`, body).then(data),
  validar: (id) =>
    httpClient.post(`${apiEndpoints.documentosOc}/${encodeURIComponent(id)}/validar`, {}).then(data),
};
