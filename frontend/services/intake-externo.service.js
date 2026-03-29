import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

/** Ingesta automática WhatsApp / correo → Base Maestra (respuesta sugerida en la misma respuesta API). */
export const intakeExternoService = {
  post: (body) => httpClient.post(apiEndpoints.intakeExterno, body).then(data),
};
