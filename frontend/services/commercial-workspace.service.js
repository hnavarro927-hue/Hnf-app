import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const commercialWorkspaceService = {
  listPropuestas: () => httpClient.get(apiEndpoints.commercialPropuestas).then(data),
  listBorradores: () => httpClient.get(apiEndpoints.commercialBorradoresCorreo).then(data),
  createPropuesta: (body) => httpClient.post(apiEndpoints.commercialPropuestas, body).then(data),
  patchPropuesta: (id, body) =>
    httpClient.patch(`${apiEndpoints.commercialPropuestas}/${encodeURIComponent(id)}`, body).then(data),
  postBorradorJarvis: (body) => httpClient.post(apiEndpoints.commercialBorradorJarvis, body).then(data),
};
