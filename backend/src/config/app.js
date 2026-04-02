// Variables mínimas esperadas (tras `load-env.js`: raíz `.env` y `backend/.env`):
// - PORT: puerto HTTP inyectado por la plataforma de deployment.
// - BACKEND_PORT: puerto HTTP local del backend.

export const appConfig = {
  port: Number(process.env.PORT || process.env.BACKEND_PORT || 4000),
};