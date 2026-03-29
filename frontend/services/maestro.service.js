import { apiEndpoints } from '../config/api-endpoints.js';
import { appConfig } from '../config/app.config.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const maestroService = {
  getContactos: () => httpClient.get(apiEndpoints.maestroContactos).then(data),
  postContacto: (body) => httpClient.post(apiEndpoints.maestroContactos, body).then(data),
  patchContacto: (id, body) =>
    httpClient.patch(`${apiEndpoints.maestroContactos}/${encodeURIComponent(id)}`, body).then(data),

  getTecnicos: () => httpClient.get(apiEndpoints.maestroTecnicos).then(data),
  postTecnico: (body) => httpClient.post(apiEndpoints.maestroTecnicos, body).then(data),
  patchTecnico: (id, body) =>
    httpClient.patch(`${apiEndpoints.maestroTecnicos}/${encodeURIComponent(id)}`, body).then(data),

  getConductores: () => httpClient.get(apiEndpoints.maestroConductores).then(data),
  postConductor: (body) => httpClient.post(apiEndpoints.maestroConductores, body).then(data),
  patchConductor: (id, body) =>
    httpClient.patch(`${apiEndpoints.maestroConductores}/${encodeURIComponent(id)}`, body).then(data),

  getVehiculos: () => httpClient.get(apiEndpoints.maestroVehiculos).then(data),
  postVehiculo: (body) => httpClient.post(apiEndpoints.maestroVehiculos, body).then(data),
  patchVehiculo: (id, body) =>
    httpClient.patch(`${apiEndpoints.maestroVehiculos}/${encodeURIComponent(id)}`, body).then(data),

  getDocumentos: () => httpClient.get(apiEndpoints.maestroDocumentos).then(data),
  ingestDocumentos: (body) => httpClient.post(apiEndpoints.maestroDocumentosIngesta, body).then(data),
  repararVinculosDocumentos: (body) =>
    httpClient.post(apiEndpoints.maestroDocumentosRepararVinculos, body || {}).then(data),
  patchDocumento: (id, body) =>
    httpClient.patch(`${apiEndpoints.maestroDocumentos}/${encodeURIComponent(id)}`, body).then(data),
  corregirDestinoDocumento: (id, body) =>
    httpClient
      .patch(`${apiEndpoints.maestroDocumentos}/${encodeURIComponent(id)}/corregir-destino`, body)
      .then(data),
  getBandeja: (responsable, query = {}) => {
    const q = new URLSearchParams();
    if (query.estado != null && query.estado !== '') q.set('estado', String(query.estado));
    if (query.destino != null && query.destino !== '') q.set('destino', String(query.destino));
    if (query.pendiente != null && query.pendiente !== '') q.set('pendiente', String(query.pendiente));
    if (query.limit != null) q.set('limit', String(query.limit));
    if (query.offset != null) q.set('offset', String(query.offset));
    const qs = q.toString();
    const path = `${apiEndpoints.maestroBandeja}/${encodeURIComponent(responsable)}${qs ? `?${qs}` : ''}`;
    return httpClient.get(path).then(data);
  },
  getIntakeOperativoResumen: () =>
    httpClient.get(apiEndpoints.maestroIntakeOperativoResumen).then(data),
  reclasificarDocumento: (id) =>
    httpClient.post(`${apiEndpoints.maestroDocumentos}/${encodeURIComponent(id)}/reclasificar`, {}).then(data),
  postCrearEntidadDesdeDocumento: (id, body) =>
    httpClient
      .post(`${apiEndpoints.maestroDocumentos}/${encodeURIComponent(id)}/crear-entidad`, body)
      .then(data),
  postAprobarDocumento: (id, body) =>
    httpClient
      .post(`${apiEndpoints.maestroDocumentos}/${encodeURIComponent(id)}/aprobar`, body || {})
      .then(data),

  async downloadDocumentoBlob(id) {
    const path = `${apiEndpoints.maestroDocumentos}/${encodeURIComponent(id)}/descarga`;
    return httpClient.getBlob(path);
  },

  urlDescargaDocumento(id) {
    return `${appConfig.apiBaseUrl}${apiEndpoints.maestroDocumentos}/${encodeURIComponent(id)}/descarga`;
  },
};
