/** Lista opcional: orígenes exactos separados por coma (dominio propio en Vercel, etc.). */
const originsFromEnv = () => {
  const raw = process.env.HNF_CORS_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Orígenes permitidos para CORS.
 * - Dev / iPad LAN: localhost + privadas
 * - Vercel: *.vercel.app
 * - Producción: HNF_CORS_ORIGINS (match exacto de `origin` completo, ej. https://app.tudominio.cl)
 */
export const isCorsAllowedOrigin = (origin) => {
  if (!origin || typeof origin !== 'string') return false;
  try {
    const u = new URL(origin);
    const h = (u.hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (h.endsWith('.vercel.app')) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    const m = h.match(/^172\.(\d{1,3})\./);
    if (m) {
      const n = Number(m[1]);
      if (n >= 16 && n <= 31) return true;
    }
    for (const allowed of originsFromEnv()) {
      if (allowed === origin) return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const corsHeadersForRequest = (request) => {
  const origin = request.headers.origin;
  if (!origin || !isCorsAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-HNF-Actor',
    Vary: 'Origin',
  };
};

export const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
};

export const sendSuccess = (response, statusCode, data, meta = {}) => {
  sendJson(response, statusCode, {
    success: true,
    data,
    meta,
  });
};

export const sendError = (response, statusCode, message, details = {}) => {
  sendJson(response, statusCode, {
    success: false,
    error: {
      message,
      ...details,
    },
  });
};

export const readJsonBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

export const matchRoute = (routes, method, pathname) => {
  const requestParts = pathname.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }

    const routeParts = route.path.split('/').filter(Boolean);
    if (routeParts.length !== requestParts.length) {
      continue;
    }

    const params = {};
    let isMatch = true;

    routeParts.forEach((part, index) => {
      const current = requestParts[index];
      if (part.startsWith(':')) {
        params[part.slice(1)] = current;
        return;
      }

      if (part !== current) {
        isMatch = false;
      }
    });

    if (isMatch) {
      return { route, params };
    }
  }

  return null;
};
