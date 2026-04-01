import { apiEndpoints } from '../config/api-endpoints.js';
import { httpClient } from './http-client.js';

const qs = (params = {}) => {
  const sp = new URLSearchParams();
  if (params.cliente) sp.set('cliente', params.cliente);
  if (params.estado) sp.set('estado', params.estado);
  const q = sp.toString();
  return q ? `?${q}` : '';
};

/**
 * Normaliza la respuesta GET del backend: siempre un array (fuente única servidor).
 * Tolera envelopes `{ success, data }` o respuestas mal formadas sin romper el listado.
 */
export const unwrapFlotaSolicitudesList = (body) => {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (typeof body !== 'object') return [];
  if (Array.isArray(body.data)) return body.data;
  return [];
};

/** POST 201: exige cuerpo HNF con data.id antes de considerar persistido. */
export const assertFlotaCreatePersisted = (body) => {
  if (!body || typeof body !== 'object') {
    throw new Error('El servidor no devolvió un cuerpo JSON válido al crear la solicitud.');
  }
  if (body.success === false) {
    const m = body.error?.message || 'El servidor rechazó la creación.';
    throw new Error(m);
  }
  const row = body.data;
  if (!row || typeof row !== 'object' || !String(row.id || '').trim()) {
    throw new Error('El servidor respondió sin id de solicitud: no se confirmó el guardado.');
  }
  return row;
};

export const flotaSolicitudService = {
  getAll: (params) => httpClient.get(`${apiEndpoints.flotaSolicitudes}${qs(params)}`),
  create: (body) => httpClient.post(apiEndpoints.flotaSolicitudes, body),
  patch: (id, body) =>
    httpClient.patch(`${apiEndpoints.flotaSolicitudes}/${encodeURIComponent(id)}`, body),
};
