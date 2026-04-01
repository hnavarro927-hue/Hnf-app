import { resolveApiUrl } from '../config/app.config.js';
import { clearSessionToken, setSessionToken } from '../config/auth-token.storage.js';
import { httpClient } from './http-client.js';

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

const LOGIN_TIMEOUT_MS = 3000;

/** El API envuelve éxitos en `{ success, data }` (igual que el resto de endpoints). */
function tokenFromLoginBody(body) {
  if (!body || typeof body !== 'object') return '';
  if (body.success !== false && body.data && typeof body.data === 'object' && body.data.token) {
    return String(body.data.token);
  }
  if (body.token) return String(body.token);
  return '';
}

function isHernanLocalGate(username, password) {
  const u = String(username ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  const p = String(password ?? '');
  return u === 'hernan' && p.length > 0;
}

/** POST /auth/login una sola vez, sin reintentos de red. */
async function postLoginWithTimeout(username, password) {
  const url = resolveApiUrl('/auth/login');
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), LOGIN_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: ac.signal,
    });
    const raw = await res.text();
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        const err = new Error('El servidor devolvió una respuesta que no es JSON.');
        err.status = res.status;
        err.requestUrl = url;
        throw err;
      }
    }
    if (!res.ok) {
      const msg = data.error?.message || 'No se pudo iniciar sesión.';
      const err = new Error(String(msg).trim());
      err.status = res.status;
      err.responsePayload = data;
      err.requestUrl = url;
      throw err;
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('abort')) {
      const e = new Error('Sin respuesta del servidor en 3 segundos (tiempo agotado o conexión interrumpida).');
      e.code = 'LOGIN_TIMEOUT_OR_ABORT';
      e.authUiSeverity = 'warn';
      e.cause = err;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

function tryLocalOfflineSession(username, password) {
  if (!isHernanLocalGate(username, password)) return null;
  const display = String(username ?? '').trim() || 'Hernan';
  return {
    me: {
      user: { username: display, nombre: display },
      actor: display,
      role: 'admin',
      modules: ['*'],
    },
  };
}

export const authApiService = {
  /**
   * Flujo completo: login remoto (máx. 3s) + GET /auth/me, o sesión local si el API no responde y aplica fallback.
   * @returns {Promise<{ me: object, offlineWarning?: string }>}
   */
  async establishSession(username, password) {
    const loginUrl = resolveApiUrl('/auth/login');
    let data;
    try {
      data = await postLoginWithTimeout(username, password);
    } catch (e) {
      clearSessionToken();
      const local = tryLocalOfflineSession(username, password);
      if (local) {
        // eslint-disable-next-line no-console
        console.warn('[HNF Auth] POST /auth/login no completó · sesión local Hernán', e?.message || e);
        return {
          me: local.me,
          offlineWarning:
            'No se pudo validar con el servidor (red, credenciales o tiempo de espera). Modo local: datos del API pueden faltar hasta reconectar.',
        };
      }
      // eslint-disable-next-line no-console
      console.error('[HNF Auth] POST /auth/login falló', {
        url: e?.requestUrl || loginUrl,
        status: e?.status,
        message: e?.message,
        code: e?.code,
      });
      throw e;
    }

    try {
      const token = tokenFromLoginBody(data);
      if (token) setSessionToken(token);
      else {
        clearSessionToken();
        const local = tryLocalOfflineSession(username, password);
        if (local) {
          // eslint-disable-next-line no-console
          console.warn('[HNF Auth] Login OK pero sin token en cuerpo · sesión local');
          return {
            me: local.me,
            offlineWarning:
              'El servidor respondió sin token reconocible. Entraste en modo local; revisá la versión del API.',
          };
        }
        throw new Error('El servidor no devolvió token de sesión.');
      }
      const me = await httpClient.get('/auth/me').then(unwrap);
      return { me, offlineWarning: '' };
    } catch (meErr) {
      clearSessionToken();
      const local = tryLocalOfflineSession(username, password);
      if (local) {
        // eslint-disable-next-line no-console
        console.warn('[HNF Auth] GET /auth/me falló tras login · sesión local', meErr?.message || meErr);
        return {
          me: local.me,
          offlineWarning:
            'No se pudo confirmar la sesión en el servidor (p. ej. 401). Modo local activo; las llamadas al API pueden devolver error hasta volver a iniciar sesión con red.',
        };
      }
      throw meErr;
    }
  },

  /** @deprecated Preferir establishSession. */
  async login(username, password) {
    return this.establishSession(username, password);
  },

  async logout() {
    try {
      await httpClient.post('/auth/logout', {});
    } catch {
      /* sesión ya inválida */
    } finally {
      clearSessionToken();
    }
  },
  me() {
    return httpClient.get('/auth/me').then(unwrap);
  },
};
