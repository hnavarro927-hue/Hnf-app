// Variables mínimas esperadas en runtime (public/env.js):
// - API_BASE_URL: base absoluta del backend (opcional).
const runtimeConfig = globalThis.__APP_ENV__ || {};

// Base vacía → fetch a rutas relativas (/health, /ots, …).
// - Vite dev/preview: proxy → http://localhost:4000
// - Backend sirviendo frontend empaquetado (dist): mismo origen en :4000
export const appConfig = {
  apiBaseUrl: runtimeConfig.API_BASE_URL ?? '',
};

/** Texto para UI (sidebar, dashboard). */
export const formatApiBaseLabel = () => {
  const u = runtimeConfig.API_BASE_URL;
  if (u != null && String(u).trim() !== '') return String(u).trim();
  return 'Rutas relativas · backend http://localhost:4000 (proxy en Vite dev)';
};
