import { resolveApiUrl } from '../config/app.config.js';
import { getSessionToken } from '../config/auth-token.storage.js';
import { getStoredOperatorName } from '../config/operator.config.js';
import { fetchWithRetry } from '../domain/hnf-network.js';

const buildUrl = (path) => resolveApiUrl(path);

const actorHeaders = () => {
  const name = getStoredOperatorName();
  return name ? { 'X-HNF-Actor': name } : {};
};

const request = async (path, options = {}) => {
  const { skipAuth, ...fetchInit } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...actorHeaders(),
    ...(fetchInit.headers || {}),
  };
  if (!skipAuth) {
    const t = getSessionToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const response = await fetchWithRetry(
    buildUrl(path),
    {
      ...fetchInit,
      headers,
    },
    { retries: 3, timeoutMs: 30000 }
  );

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const err = new Error(
        'El servidor devolvió una respuesta que no es JSON (¿proxy o ruta mal configurada?).'
      );
      err.status = response.status;
      throw err;
    }
  }

  if (!response.ok) {
    let msg = data.error?.message || 'No se pudo completar la operación con el servidor.';
    const vals = data.error?.validations;
    if (Array.isArray(vals) && vals.length) {
      msg = `${msg} ${vals.join(' ')}`;
    }
    const err = new Error(msg.trim());
    err.status = response.status;
    err.validations = vals;
    err.responsePayload = data;
    err.requestUrl = buildUrl(path);
    throw err;
  }

  return data;
};

export const httpClient = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts = {}) =>
    request(path, { ...opts, method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: (path, body, opts = {}) =>
    request(path, { ...opts, method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  /** Descarga binaria (Bearer + actor). */
  getBlob: async (path) => {
    const headers = { ...actorHeaders() };
    const t = getSessionToken();
    if (t) headers.Authorization = `Bearer ${t}`;
    const response = await fetchWithRetry(
      buildUrl(path),
      {
        method: 'GET',
        headers,
      },
      { retries: 2, timeoutMs: 120000 }
    );
    if (!response.ok) {
      const raw = await response.text();
      let msg = 'No se pudo descargar el archivo.';
      try {
        const j = JSON.parse(raw);
        msg = j.error?.message || msg;
      } catch {
        /* ignore */
      }
      const err = new Error(msg.trim());
      err.status = response.status;
      throw err;
    }
    return response.blob();
  },
};
