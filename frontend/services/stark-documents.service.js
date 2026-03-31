import { apiEndpoints } from '../config/api-endpoints.js';
import { resolveApiUrl } from '../config/app.config.js';
import { getSessionToken } from '../config/auth-token.storage.js';
import { getStoredOperatorName } from '../config/operator.config.js';
import { fetchWithRetry } from '../domain/hnf-network.js';
import { httpClient } from './http-client.js';

function authHeadersForMultipart() {
  const headers = {};
  const t = getSessionToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const name = getStoredOperatorName();
  if (name) headers['X-HNF-Actor'] = name;
  return headers;
}

async function parseJsonResponse(response) {
  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const err = new Error('El servidor devolvió una respuesta que no es JSON.');
      err.status = response.status;
      throw err;
    }
  }
  if (!response.ok) {
    const msg = data.error?.message || 'No se pudo completar la operación con el servidor.';
    const err = new Error(String(msg).trim());
    err.status = response.status;
    err.validations = data.error?.validations;
    throw err;
  }
  return data;
}

/**
 * @param {{
 *   file: File,
 *   origen?: string,
 *   cliente?: string,
 *   otId?: string,
 *   notas?: string,
 *   declaredDocType?: string,
 * }} payload
 */
export async function uploadStarkDocument(payload) {
  const fd = new FormData();
  fd.append('file', payload.file);
  if (payload.origen != null) fd.append('origen', String(payload.origen));
  if (payload.cliente != null) fd.append('cliente', String(payload.cliente));
  if (payload.otId != null) fd.append('otId', String(payload.otId));
  if (payload.notas != null) fd.append('notas', String(payload.notas));
  if (payload.declaredDocType != null) fd.append('declaredDocType', String(payload.declaredDocType));

  const response = await fetchWithRetry(
    resolveApiUrl(apiEndpoints.jarvisStarkDocuments),
    {
      method: 'POST',
      body: fd,
      headers: authHeadersForMultipart(),
    },
    { retries: 2, timeoutMs: 120000 }
  );
  const body = await parseJsonResponse(response);
  return body.data ?? body;
}

export async function listStarkDocuments(limit = 120) {
  const q = Number.isFinite(limit) ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const body = await httpClient.get(`${apiEndpoints.jarvisStarkDocuments}${q}`);
  return body.data ?? [];
}

export async function getStarkDocumentsSummary() {
  const body = await httpClient.get(apiEndpoints.jarvisStarkDocumentsSummary);
  return body.data ?? {};
}
