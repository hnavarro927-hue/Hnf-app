const STORAGE_KEY = 'hnfActor';

export const getStoredOperatorName = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const s = typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
    return s;
  } catch {
    return '';
  }
};

export const setStoredOperatorName = (name) => {
  try {
    const s = String(name ?? '').trim().slice(0, 80);
    if (!s) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, s);
    }
  } catch {
    /* ignore */
  }
};
