import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const arr = (res) => (Array.isArray(res?.data) ? res.data : []);

export const hnfOperativoIntegradoService = {
  getValidationQueue: () =>
    httpClient.get(apiEndpoints.hnfValidationQueue).then(arr),
  postValidationQueue: (body) => httpClient.post(apiEndpoints.hnfValidationQueue, body),
  patchValidationQueue: (id, body) =>
    httpClient.patch(`${apiEndpoints.hnfValidationQueue}/${encodeURIComponent(id)}`, body),
  confirmValidation: (id) =>
    httpClient.post(`${apiEndpoints.hnfValidationQueue}/${encodeURIComponent(id)}/confirm`, {}),
  postCargaMasiva: (body) => httpClient.post(apiEndpoints.hnfCargaMasiva, body),
  getValidatedMemory: () =>
    httpClient.get(apiEndpoints.hnfValidatedMemory).then(arr),
  getExtendedClients: () =>
    httpClient.get(apiEndpoints.hnfExtendedClients).then(arr),
  postExtendedClient: (body) => httpClient.post(apiEndpoints.hnfExtendedClients, body),
  patchExtendedClient: (id, body) =>
    httpClient.patch(`${apiEndpoints.hnfExtendedClients}/${encodeURIComponent(id)}`, body),
  getInternalDirectory: () =>
    httpClient.get(apiEndpoints.hnfInternalDirectory).then(arr),
  postInternalDirectory: (body) => httpClient.post(apiEndpoints.hnfInternalDirectory, body),
  patchInternalDirectory: (id, body) =>
    httpClient.patch(`${apiEndpoints.hnfInternalDirectory}/${encodeURIComponent(id)}`, body),
};
