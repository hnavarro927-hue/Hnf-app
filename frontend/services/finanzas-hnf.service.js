import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const finanzasHnfService = {
  getTiendas: () => httpClient.get(apiEndpoints.finanzasTiendas).then(data),
  postTienda: (body) => httpClient.post(apiEndpoints.finanzasTiendas, body).then(data),
  patchTienda: (id, body) =>
    httpClient.patch(`${apiEndpoints.finanzasTiendas}/${encodeURIComponent(id)}`, body).then(data),

  getCierres: () => httpClient.get(apiEndpoints.finanzasCierresMensuales).then(data),
  getCierre: (id) =>
    httpClient.get(`${apiEndpoints.finanzasCierresMensuales}/${encodeURIComponent(id)}`).then(data),
  getCandidatas: (periodo) =>
    httpClient
      .get(`${apiEndpoints.finanzasCierresMensuales}/candidatas?periodo=${encodeURIComponent(periodo)}`)
      .then(data),
  postCierre: (body) => httpClient.post(apiEndpoints.finanzasCierresMensuales, body).then(data),
  postIncluirOt: (cierreId, otId) =>
    httpClient
      .post(`${apiEndpoints.finanzasCierresMensuales}/${encodeURIComponent(cierreId)}/incluir-ot`, {
        ot_id: otId,
      })
      .then(data),
  postExcluirOt: (cierreId, otId) =>
    httpClient
      .post(`${apiEndpoints.finanzasCierresMensuales}/${encodeURIComponent(cierreId)}/excluir-ot`, {
        ot_id: otId,
      })
      .then(data),
  postCerrarCierre: (cierreId) =>
    httpClient
      .post(`${apiEndpoints.finanzasCierresMensuales}/${encodeURIComponent(cierreId)}/cerrar`, {})
      .then(data),
  postMarcarFacturado: (cierreId) =>
    httpClient
      .post(`${apiEndpoints.finanzasCierresMensuales}/${encodeURIComponent(cierreId)}/marcar-facturado`, {})
      .then(data),
};
