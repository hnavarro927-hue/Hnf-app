import { appConfig } from '../config/app.config.js';
import { getStoredOperatorName } from '../config/operator.config.js';
import { fetchWithRetry } from '../domain/hnf-network.js';

const buildUrl = (path) => `${appConfig.apiBaseUrl}${path}`;

const actorHeaders = () => {
  const name = getStoredOperatorName();
  return name ? { 'X-HNF-Actor': name } : {};
};

const request = async (path, options = {}) => {
  const response = await fetchWithRetry(
    buildUrl(path),
    {
      headers: {
        'Content-Type': 'application/json',
        ...actorHeaders(),
        ...(options.headers || {}),
      },
      ...options,
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
    throw err;
  }

  return data;
};

export const httpClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
