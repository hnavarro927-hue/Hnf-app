/**
 * Red HNF: reintentos + timeout. Usar en lugar de fetch directo para resiliencia.
 */

const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 12000;

/**
 * @param {string|URL} url
 * @param {RequestInit} [init]
 * @param {{ retries?: number, timeoutMs?: number }} [cfg]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, init = {}, cfg = {}) {
  const retries = typeof cfg.retries === 'number' ? cfg.retries : DEFAULT_RETRIES;
  const timeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
  let lastErr;
  const target = typeof url === 'string' ? url : String(url);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(target, { ...init, signal: ac.signal });
      clearTimeout(tid);
      return res;
    } catch (err) {
      clearTimeout(tid);
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
  }
  throw lastErr || new Error('fetchWithRetry: solicitud fallida');
}
