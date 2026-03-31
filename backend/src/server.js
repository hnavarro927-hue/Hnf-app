import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appConfig } from './config/app.js';
import { startJarvisOperationalCycleTimer } from './cron/jarvis-cycle.js';
import { routes } from './routes/index.js';
import { ensureBootstrapAdmin } from './services/auth.service.js';
import { evaluateRequestAuth } from './services/auth.gateway.js';
import { corsHeadersForRequest, matchRoute, readJsonBody, sendError } from './utils/http.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendSrcRoot = path.resolve(__dirname, '../../frontend');
const frontendDistRoot = path.resolve(__dirname, '../../frontend/dist');
const distIndex = path.join(frontendDistRoot, 'index.html');

const frontendRoot = existsSync(distIndex) ? frontendDistRoot : frontendSrcRoot;
const frontendIndexPath = path.join(frontendRoot, 'index.html');

const contentTypeByExtension = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const isSafeFrontendPath = (filePath) =>
  filePath === frontendIndexPath || filePath.startsWith(`${frontendRoot}${path.sep}`);

const getFrontendFilePath = async (pathname) => {
  if (pathname === '/') {
    return frontendIndexPath;
  }

  const decodedPath = decodeURIComponent(pathname);
  const candidatePath = path.resolve(frontendRoot, `.${decodedPath}`);

  if (isSafeFrontendPath(candidatePath)) {
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      return frontendIndexPath;
    }
  }

  return frontendIndexPath;
};

const serveFrontendFile = async (response, pathname) => {
  const filePath = await getFrontendFilePath(pathname);
  const fileContent = await readFile(filePath);
  const extension = path.extname(filePath);

  response.writeHead(200, {
    'Content-Type':
      contentTypeByExtension[extension] || 'application/octet-stream',
  });

  response.end(fileContent);
};

const lanIpv4Addresses = () => {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const addrs of Object.values(ifs)) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
};

const server = createServer(async (request, response) => {
  const ch = corsHeadersForRequest(request);
  for (const [k, v] of Object.entries(ch)) {
    response.setHeader(k, v);
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, 'http://localhost');
  const matched = matchRoute(routes, request.method, url.pathname);

  if (!matched && request.method === 'GET') {
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

  if (!matched) {
    return sendError(response, 404, 'Ruta no encontrada.', {
      method: request.method,
      path: url.pathname,
    });
  }

  try {
    request.params = matched.params;

    const authResult = await evaluateRequestAuth(request, url.pathname);
    if (!authResult.ok) {
      return sendError(response, authResult.status, authResult.message, authResult.details);
    }
    request.hnfAuth = authResult.context;
    request.hnfActor = authResult.context.actorLabel || 'sistema';

    const ct = String(request.headers['content-type'] || '').toLowerCase();
    const isMultipart = ct.includes('multipart/form-data');
    request.body =
      ['POST', 'PATCH', 'PUT'].includes(request.method) && !isMultipart
        ? await readJsonBody(request)
        : {};

    return matched.route.handler(request, response);
  } catch (error) {
    return sendError(response, 500, 'Error interno del servidor.', {
      detail: error.message,
    });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(
      `[HNF] Backend ya en ejecución: el puerto ${appConfig.port} está ocupado. No se inicia un segundo listener.`
    );
    process.exit(0);
    return;
  }
  throw err;
});

(async () => {
  try {
    await ensureBootstrapAdmin();
  } catch (e) {
    console.error('[HNF Auth] bootstrap usuarios', e);
    process.exit(1);
  }
  server.listen(appConfig.port, '0.0.0.0', () => {
    startJarvisOperationalCycleTimer();
    const mode = frontendRoot === frontendDistRoot ? 'dist (build)' : 'código fuente';
    const ips = lanIpv4Addresses();
    console.log(`HNF backend listening on 0.0.0.0:${appConfig.port} (todas las interfaces)`);
    console.log(`  Local:   http://127.0.0.1:${appConfig.port}`);
    for (const ip of ips) {
      console.log(`  En LAN:  http://${ip}:${appConfig.port}`);
    }
    console.log(`HNF frontend static: ${mode} → ${frontendRoot}`);
    if (frontendRoot !== frontendDistRoot) {
      console.warn(
        '[HNF] Sin frontend/dist: ejecuta "npm run build --prefix frontend" para servir el bundle (jsPDF y módulos npm).'
      );
    }
  });
})();
