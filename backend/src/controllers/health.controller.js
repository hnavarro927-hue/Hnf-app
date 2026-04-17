import { appConfig } from '../config/app.js';
import { connectDatabase } from '../config/database.js';
import { sendJson, sendSuccess } from '../utils/http.js';

/** Respuesta mínima para probes (sin DB). */
export const apiHealthPing = async (_request, response) => {
  sendJson(response, 200, { ok: true });
};

export const healthcheck = async (request, response) => {
  const database = await connectDatabase();

  sendSuccess(response, 200, {
    app: 'HNF Servicios Integrales API',
    status: 'ok',
    database,
    continuity: {
      listenPort: appConfig.port,
      serverTime: new Date().toISOString(),
    },
  }, {
    resource: 'health',
  });
};
