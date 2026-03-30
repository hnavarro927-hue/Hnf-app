import { resolveApiUrl } from '../config/app.config.js';
import { clearSessionToken, setSessionToken } from '../config/auth-token.storage.js';
import { httpClient } from './http-client.js';

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

export const authApiService = {
  async login(username, password) {
    const loginUrl = resolveApiUrl('/auth/login');
    try {
      const res = await httpClient.post(
        '/auth/login',
        { username, password },
        { skipAuth: true }
      );
      const data = unwrap(res);
      if (data?.token) setSessionToken(data.token);
      return data;
    } catch (e) {
      const hint = e?.responsePayload?.error?.debugHint;
      // eslint-disable-next-line no-console
      console.error('[HNF Auth] POST /auth/login falló', {
        url: e?.requestUrl || loginUrl,
        status: e?.status,
        message: e?.message,
        debugHint: hint,
        error: e?.responsePayload?.error,
      });
      throw e;
    }
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
