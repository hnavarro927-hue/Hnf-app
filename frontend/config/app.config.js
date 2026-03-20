// Variables mínimas esperadas en runtime:
// - API_BASE_URL: base URL del backend.
const runtimeConfig = globalThis.__APP_ENV__ || {};
const defaultApiBaseUrl = globalThis.location?.hostname === 'localhost'
  ? 'http://localhost:4000'
  : '';

export const appConfig = {
  apiBaseUrl: runtimeConfig.API_BASE_URL || defaultApiBaseUrl,
};
