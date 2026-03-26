/**
 * Respaldo local controlado (localStorage). No sustituye datos oficiales en servidor.
 */

const PREFIX = 'hnf_shell_v1_';
const MAX_VIEW_CACHE_BYTES = 450_000;

export function save(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('[HNF storage] save', key, e);
  }
}

export function load(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

export function saveViewCache(activeView, viewData) {
  if (!activeView) return;
  try {
    const s = JSON.stringify(viewData);
    if (s.length > MAX_VIEW_CACHE_BYTES) return;
    save(`view:${activeView}`, { at: new Date().toISOString(), data: viewData });
  } catch (e) {
    console.warn('[HNF storage] saveViewCache', e);
  }
}

export function loadViewCache(activeView) {
  if (!activeView) return null;
  const row = load(`view:${activeView}`, null);
  return row && typeof row === 'object' && 'data' in row ? row.data : null;
}

export function saveShellMeta(meta) {
  save('meta', meta);
}

export function loadShellMeta() {
  return load('meta', null);
}
