import { createServer } from 'node:http';
import { appConfig } from './config/app.js';
import { routes } from './routes/index.js';
import { matchRoute, readJsonBody, sendError, sendSuccess } from './utils/http.js';

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/') {
    return sendSuccess(response, 200, {
      app: 'HNF Servicios Integrales API',
      endpoints: ['/health', '/ots', '/clients', '/vehicles', '/expenses'],
    }, {
      resource: 'root',
    });
  }

  const matched = matchRoute(routes, request.method, url.pathname);

  if (!matched) {
    return sendError(response, 404, 'Ruta no encontrada.', {
      method: request.method,
      path: url.pathname,
    });
  }

  try {
    request.params = matched.params;
    request.body = ['POST', 'PATCH', 'PUT'].includes(request.method)
      ? await readJsonBody(request)
      : {};

    return matched.route.handler(request, response);
  } catch (error) {
    return sendError(response, 500, 'Error interno del servidor.', {
      detail: error.message,
    });
  }
});

server.listen(appConfig.port, () => {
  console.log(`HNF backend running on http://localhost:${appConfig.port}`);
});
