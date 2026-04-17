import { allowAuthDebugEndpoints } from '../config/runtimeEnv.js';
import { resolveRbacRole } from '../config/rbac.config.js';
import { getRequestActor } from '../utils/requestActor.js';
import { resolveAuthFromBearer } from './auth.service.js';

const truthy = (v) => v === '1' || String(v).toLowerCase() === 'true';

const isPublicRoute = (method, pathname) => {
  if (pathname === '/api/health' && method === 'GET') return true;
  if (pathname === '/health' && method === 'GET') return true;
  if (pathname === '/auth/login' && method === 'POST') return true;
  if (pathname === '/intake/externo' && method === 'POST') return true;
  if (pathname === '/auth/debug-users' && method === 'GET' && allowAuthDebugEndpoints()) return true;
  if (pathname === '/jarvis/intake' && method === 'POST' && process.env.JARVIS_PUBLIC === 'true') {
    return true;
  }
  return false;
};

const bearerToken = (request) => {
  const raw = request.headers?.authorization || request.headers?.Authorization || '';
  const m = /^Bearer\s+(\S+)/i.exec(String(raw));
  return m ? m[1].trim() : '';
};

/**
 * Resuelve identidad por sesión Bearer o, si está habilitado, por header legado X-HNF-Actor.
 */
export async function evaluateRequestAuth(request, pathname) {
  const method = String(request.method || 'GET').toUpperCase();

  if (pathname === '/auth/debug-users' && method === 'GET' && !allowAuthDebugEndpoints()) {
    return { ok: false, status: 404, message: 'No encontrado.', details: { code: 'NOT_FOUND' } };
  }

  if (truthy(process.env.HNF_AUTH_DISABLED)) {
    return {
      ok: true,
      context: {
        user: null,
        userId: null,
        role: 'hernan',
        actorLabel: 'Modo sin autenticación (HNF_AUTH_DISABLED)',
        token: null,
        legacy: true,
      },
    };
  }

  if (isPublicRoute(method, pathname)) {
    return {
      ok: true,
      context: {
        user: null,
        userId: null,
        role: null,
        actorLabel: 'público',
        token: null,
        public: true,
      },
    };
  }

  const token = bearerToken(request);
  if (token) {
    const ctx = await resolveAuthFromBearer(token);
    if (ctx) {
      return { ok: true, context: { ...ctx, legacy: false } };
    }
  }

  if (truthy(process.env.HNF_LEGACY_ACTOR_HEADER)) {
    const actor = getRequestActor(request);
    if (actor && actor !== 'sistema') {
      const role = resolveRbacRole(actor);
      return {
        ok: true,
        context: {
          user: null,
          userId: null,
          role,
          actorLabel: actor,
          token: null,
          legacy: true,
        },
      };
    }
  }

  return {
    ok: false,
    status: 401,
    message: 'Debes iniciar sesión.',
    details: { code: 'UNAUTHORIZED' },
  };
}
