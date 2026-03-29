import { clearSessionToken, setSessionToken } from '../config/auth-token.storage.js';
import { httpClient } from './http-client.js';

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

export const authApiService = {
  async login(username, password) {
    const res = await httpClient.post(
      '/auth/login',
      { username, password },
      { skipAuth: true }
    );
    const data = unwrap(res);
    if (data?.token) setSessionToken(data.token);
    return data;
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
