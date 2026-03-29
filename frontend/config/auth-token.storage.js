const TOKEN_KEY = 'hnfSessionToken';

export const getSessionToken = () => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  } catch {
    return '';
  }
};

export const setSessionToken = (token) => {
  try {
    const s = String(token ?? '').trim();
    if (!s) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, s);
  } catch {
    /* ignore */
  }
};

export const clearSessionToken = () => setSessionToken('');
