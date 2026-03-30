import { allowAuthDebugEndpoints } from '../config/runtimeEnv.js';
import { buildMePayload, listUsersSanitizedForDebug, login, logout } from '../services/auth.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

const clientIp = (request) => {
  const xf = request.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return request.socket?.remoteAddress || null;
};

export const postAuthLogin = async (request, response) => {
  const { username, password } = request.body || {};
  const r = await login(username, password, { ip: clientIp(request) });
  if (!r.ok) {
    return sendError(response, 401, r.message || 'No fue posible iniciar sesión.', {
      code: r.code || 'LOGIN_FAILED',
    });
  }
  sendSuccess(
    response,
    200,
    {
      token: r.token,
      expiresAt: r.expiresAt,
      user: r.user,
      authNote:
        'Autenticación interna inicial. Guardá el token solo en entornos controlados; en producción usar HTTPS.',
    },
    { resource: 'auth/login' }
  );
};

export const postAuthLogout = async (request, response) => {
  const raw = request.headers?.authorization || '';
  const m = /^Bearer\s+(\S+)/i.exec(String(raw));
  const token = request.hnfAuth?.token || (m ? m[1].trim() : '');
  await logout(token, request.hnfAuth?.actorLabel);
  sendSuccess(response, 200, { ok: true }, { resource: 'auth/logout' });
};

export const getAuthMe = async (request, response) => {
  const payload = buildMePayload(request.hnfAuth);
  sendSuccess(response, 200, payload, { resource: 'auth/me' });
};

export const getAuthDebugUsers = async (request, response) => {
  if (!allowAuthDebugEndpoints()) {
    return sendError(response, 404, 'No encontrado.', { code: 'NOT_FOUND' });
  }
  const users = await listUsersSanitizedForDebug();
  sendSuccess(response, 200, users, {
    resource: 'auth/debug-users',
    note: 'Solo disponible cuando NODE_ENV≠production. No incluye contraseñas.',
  });
};
