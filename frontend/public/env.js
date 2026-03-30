/** Configuración opcional en runtime (cargada antes del bundle). */
window.__APP_ENV__ = window.__APP_ENV__ || {};
//
// LOCAL: si definís API_BASE_URL acá, tiene prioridad sobre VITE_* del build.
// No pongas la URL de Render en env.js mientras desarrollás contra backend en :4000.
//
// Producción (Vercel u otro estático): la API se fija en build con VITE_API_BASE_URL
// (ver frontend/.env.production → https://hnf-app.onrender.com).
// Solo usá esto para sobrescribir sin recompilar:
//   window.__APP_ENV__ = { API_BASE_URL: 'https://hnf-app.onrender.com' };
//
// Dev en LAN (iPad → notebook con Vite): si el API corre en otro host:
//   window.__APP_ENV__ = { API_BASE_URL: 'http://192.168.x.x:4000' };
