import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appConfig } from './config/app.js';
import { routes } from './routes/index.js';
import { matchRoute, readJsonBody, sendError, sendSuccess } from './utils/http.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '../../frontend');

const staticFiles = new Map([
  ['/env.js', 'env.js'],
  ['/main.js', 'main.js'],
  ['/index.html', 'index.html'],
  ['/components/card.js', 'components/card.js'],
  ['/components/shell.js', 'components/shell.js'],
  ['/config/api-endpoints.js', 'config/api-endpoints.js'],
  ['/config/app.config.js', 'config/app.config.js'],
  ['/config/form-definitions.js', 'config/form-definitions.js'],
  ['/services/client.service.js', 'services/client.service.js'],
  ['/services/expense.service.js', 'services/expense.service.js'],
  ['/services/health.service.js', 'services/health.service.js'],
  ['/services/http-client.js', 'services/http-client.js'],
  ['/services/ot.service.js', 'services/ot.service.js'],
  ['/services/vehicle.service.js', 'services/vehicle.service.js'],
  ['/views/admin.js', 'views/admin.js'],
  ['/views/clima.js', 'views/clima.js'],
  ['/views/dashboard.js', 'views/dashboard.js'],
  ['/views/flota.js', 'views/flota.js'],
]);

const contentTypeByExtension = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const serveFrontendFile = async (response, pathname) => {
  const relativeFile = staticFiles.get(pathname) || 'index.html';
  const filePath = path.join(frontendRoot, relativeFile);
  const fileContent = await readFile(filePath);
  const extension = path.extname(filePath);
  response.writeHead(200, {
    'Content-Type': contentTypeByExtension[extension] || 'application/octet-stream',
  });
  response.end(fileContent);
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && (url.pathname === '/' || staticFiles.has(url.pathname))) {
    try {
      await serveFrontendFile(response, url.pathname);
      return;
    } catch (error) {
      return sendError(response, 500, 'No fue posible servir el frontend.', {
        detail: error.message,
        path: url.pathname,
      });
    }
  }

  const matched = matchRoute(routes, request.method, url.pathname);

  if (!matched) {
    if (request.method === 'GET') {
      try {
        await serveFrontendFile(response, url.pathname);
        return;
      } catch (error) {
        return sendError(response, 404, 'Ruta no encontrada.', {
          method: request.method,
          path: url.pathname,
        });
      }
    }

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
