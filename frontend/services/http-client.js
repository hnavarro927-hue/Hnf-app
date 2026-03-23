import { appConfig } from '../config/app.config.js';
import { getStoredOperatorName } from '../config/operator.config.js';

const buildUrl = (path) => `${appConfig.apiBaseUrl}${path}`;

const actorHeaders = () => {
  const name = getStoredOperatorName();
  return name ? { 'X-HNF-Actor': name } : {};
};

const request = async (path, options = {}) => {
  const response = await fetch(buildUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...actorHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    let msg = data.error?.message || 'No se pudo completar la operación con el servidor.';
    const vals = data.error?.validations;
    if (Array.isArray(vals) && vals.length) {
      msg = `${msg} ${vals.join(' ')}`;
    }
    throw new Error(msg.trim());
  }

  return data;
};

export const httpClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
