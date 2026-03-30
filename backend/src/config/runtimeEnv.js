/**
 * Entorno de ejecución Node (no confundir con “modo dev” del frontend Vite).
 * En producción (Render, etc.) debe definirse NODE_ENV=production.
 */
export const isNodeProduction = () =>
  String(process.env.NODE_ENV || '').toLowerCase() === 'production';

/** Rutas de diagnóstico de auth: deshabilitadas en producción explícita. */
export const allowAuthDebugEndpoints = () => !isNodeProduction();

/** Detalle extra en respuestas 401 de login (solo fuera de producción). */
export const allowAuthLoginDebugHints = () => !isNodeProduction();
