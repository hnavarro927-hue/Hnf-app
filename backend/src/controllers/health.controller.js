import { appConfig } from '../config/app.js';
import { connectDatabase } from '../config/database.js';
import { sendSuccess } from '../utils/http.js';

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
