// Resolución API (una sola verdad, en orden):
// 1) public/env.js → window.__APP_ENV__.API_BASE_URL (runtime, máxima prioridad)
// 2) Vite build → import.meta.env.VITE_API_BASE_URL (obligatorio en hosting estático tipo Vercel)
// 3) Cadena vacía → rutas relativas al origen (dev con proxy, o backend sirviendo el mismo host)
const runtimeConfig = globalThis.__APP_ENV__ || {};

const viteBuiltApi =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : '';

const runtimeOverride =
  runtimeConfig.API_BASE_URL != null && String(runtimeConfig.API_BASE_URL).trim() !== ''
    ? String(runtimeConfig.API_BASE_URL).replace(/\/$/, '')
    : '';

const hostname =
  typeof globalThis.location !== 'undefined' && globalThis.location?.hostname
    ? String(globalThis.location.hostname)
    : '';
const isLocalhostHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
const isLanHost = Boolean(hostname && !isLocalhostHost);
const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

export const appConfig = {
  apiBaseUrl: runtimeOverride || viteBuiltApi || '',
};

/** URL absoluta del path de API (sin hardcodear host: usa solo appConfig + origen del navegador). */
export const resolveApiUrl = (path) => {
  const p = String(path || '').startsWith('/') ? path : `/${path}`;
  const base = String(appConfig.apiBaseUrl || '').replace(/\/$/, '');
  if (base) return `${base}${p}`;
  if (typeof globalThis.location !== 'undefined' && globalThis.location.origin) {
    return `${String(globalThis.location.origin).replace(/\/$/, '')}${p}`;
  }
  return p;
};

/** Etiqueta para UI: LOCAL (bundle dev) vs PRODUCCIÓN (build optimizado). */
export const getHnfRuntimeEnvironment = () =>
  typeof import.meta !== 'undefined' && import.meta.env?.PROD ? 'PRODUCCIÓN' : 'LOCAL';

export const getLoginDebugContext = () => ({
  apiUrl: appConfig.apiBaseUrl
    ? appConfig.apiBaseUrl
    : typeof globalThis.location !== 'undefined'
      ? `(relativo · ${globalThis.location.origin})`
      : '—',
  environment: getHnfRuntimeEnvironment(),
});

export const getApiActivaLabel = () => {
  if (appConfig.apiBaseUrl) return appConfig.apiBaseUrl;
  if (typeof globalThis.location !== 'undefined' && globalThis.location.origin) {
    return `(relativo · ${globalThis.location.origin})`;
  }
  return '(sin base)';
};

if (typeof import.meta !== 'undefined') {
  console.log(`API ACTIVA: ${getApiActivaLabel()}`);
}

/** Texto para UI (sidebar, dashboard). */
export const formatApiBaseLabel = () => {
  const base = appConfig.apiBaseUrl;
  if (base) return base;
  if (isLanHost) {
    return `Origen ${hostname} · API vía proxy (mismo host de Vite)`;
  }
  if (isDev) {
    return 'Desarrollo · API por proxy (rutas relativas)';
  }
  return 'Sin API_BASE_URL: revisá build (VITE_API_BASE_URL) o public/env.js';
};

export const getAppAccessContext = () => ({
  hostname,
  isLanHost,
  isLocalhostHost,
});
