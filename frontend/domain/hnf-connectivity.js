import { appConfig } from '../config/app.config.js';
import { fetchWithRetry } from './hnf-network.js';

/**
 * Conectividad app↔API: SSOT documentado en `hnf-architecture-contract.js`.
 * No duplicar reglas de “OK” en otras capas sin actualizar ese contrato.
 */

/** URL de GET /health (misma resolución que el panel Continuidad del sistema). */
export const getHealthRequestUrl = () => {
  const base = String(appConfig.apiBaseUrl || '').replace(/\/$/, '');
  return base ? `${base}/health` : '/health';
};

/** Misma regla que el panel de continuidad: cuerpo JSON con data.status === 'ok'. */
export const isHealthPayloadOk = (body) =>
  Boolean(
    body &&
    body.success !== false &&
    body.data &&
    String(body.data.status || '').toLowerCase() === 'ok'
  );

/**
 * Comprueba si el backend responde /health correctamente.
 * No usa httpClient (headers JSON, etc.): mismo camino que el panel de continuidad.
 */
export async function probeBackendHealth(options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const url = getHealthRequestUrl();
  try {
    const res = await fetchWithRetry(
      url,
      { method: 'GET', cache: 'no-store' },
      { retries: 3, timeoutMs }
    );
    const text = await res.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    const ok = res.ok && isHealthPayloadOk(body);
    return { ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}
