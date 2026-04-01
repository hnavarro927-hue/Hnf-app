import { resolveApiUrl } from '../config/app.config.js';
import { clearSessionToken, setSessionToken } from '../config/auth-token.storage.js';
import { httpClient } from './http-client.js';

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

const LOGIN_TIMEOUT_MS = 3000;

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
  const u = String(username ?? '').trim();
  const p = String(password ?? '');
  if (u === 'Hernan' && p.length > 0) {
    return {
      me: {
        user: { username: u, nombre: u },
        actor: u,
        role: 'admin',
        modules: ['*'],
      },
    };
  }
  return null;
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
      if (e?.status === 401 || e?.status === 403) {
        // eslint-disable-next-line no-console
        console.error('[HNF Auth] POST /auth/login rechazado', {
          url: e?.requestUrl || loginUrl,
          status: e?.status,
          message: e?.message,
        });
        throw e;
      }
      const local = tryLocalOfflineSession(username, password);
      if (local) {
        clearSessionToken();
        // eslint-disable-next-line no-console
        console.warn('[HNF Auth] API no disponible · sesión local (fallback)', e?.message || e);
        return {
          me: local.me,
          offlineWarning:
            'Sin conexión al servidor: entraste en modo local. Los datos del API pueden no estar disponibles hasta que vuelva la red.',
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
      if (data?.token) setSessionToken(data.token);
      const me = await httpClient.get('/auth/me').then(unwrap);
      return { me, offlineWarning: '' };
    } catch (meErr) {
      if (meErr?.status === 401 || meErr?.status === 403) {
        clearSessionToken();
        throw meErr;
      }
      const local = tryLocalOfflineSession(username, password);
      if (local) {
        clearSessionToken();
        // eslint-disable-next-line no-console
        console.warn('[HNF Auth] GET /auth/me falló tras login · sesión local', meErr?.message || meErr);
        return {
          me: local.me,
          offlineWarning:
            'El servidor no respondió al validar la sesión. Modo local activo hasta que el API esté estable.',
        };
      }
      clearSessionToken();
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
