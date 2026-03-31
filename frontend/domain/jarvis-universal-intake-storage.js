/**
 * Cola local de ingesta universal (no se pierde; revision_jarvis_pendiente conservado).
 * Próximo paso: API de archivos + persistencia servidor.
 */

const STORAGE_KEY = 'hnf_jarvis_universal_intake_v1';
const MAX_ITEMS = 200;

function safeParse(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function listUniversalIntakeItems() {
  if (typeof localStorage === 'undefined') return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

/**
 * @param {object} item
 */
export function appendUniversalIntakeItem(item) {
  if (typeof localStorage === 'undefined') return null;
  const row = {
    ...item,
    id: item.id || `uji_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    creadoEn: item.creadoEn || new Date().toISOString(),
  };
  const arr = [row, ...listUniversalIntakeItems()].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  return row;
}

export function countPendingJarvisDocumentReview() {
  return listUniversalIntakeItems().filter((x) => x && x.revision_jarvis_pendiente).length;
}

export function countUniversalIntakeLast24h() {
  const t0 = Date.now() - 86400000;
  return listUniversalIntakeItems().filter((x) => {
    const t = new Date(x?.creadoEn || 0).getTime();
    return Number.isFinite(t) && t >= t0;
  }).length;
}
