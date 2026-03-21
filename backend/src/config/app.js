// Variables mínimas esperadas:
// - PORT: puerto HTTP inyectado por la plataforma de deployment.
// - BACKEND_PORT: puerto HTTP local del backend.

export const appConfig = {
  port: Number(process.env.PORT || process.env.BACKEND_PORT || 4000),
};