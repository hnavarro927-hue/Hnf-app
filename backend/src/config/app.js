// Variables mínimas esperadas:
// - BACKEND_PORT: puerto HTTP del backend.
export const appConfig = {
  port: Number(process.env.BACKEND_PORT || 4000),
};
