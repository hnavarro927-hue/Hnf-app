/**
 * HNF Memory — base para auto-mejora futura (decisiones de Autopilot / operador).
 * Persistencia simple en localStorage; contrato estable para backend después.
 */

export const HNF_MEMORY_VERSION = '1';

const STORAGE_DECISIONS = 'hnf_memory_autopilot_decisions_v1';
const STORAGE_DOC_APPROVAL = 'hnf_memory_doc_approval_patterns_v1';

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return p;
  } catch {
    return fallback;
  }
};

const writeJson = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota / privado */
  }
};

/**
 * @param {object} decision
 * @param {'aprobada'|'rechazada'} decision.tipo
 * @param {string} [decision.actionId]
 * @param {string} [decision.codigo]
 * @param {string} [decision.modulo]
 * @param {string} [decision.actor]
 * @param {string} [decision.nota]
 */
export function rememberAutopilotDecision(decision) {
  const arr = readJson(STORAGE_DECISIONS, []);
  const row = {
    ...decision,
    at: decision.at || new Date().toISOString(),
    v: HNF_MEMORY_VERSION,
  };
  arr.push(row);
  writeJson(STORAGE_DECISIONS, arr.slice(-800));
  return row;
}

/**
 * Resumen agregado para paneles y futuros modelos.
 */
export function getAutopilotMemorySummary() {
  const arr = readJson(STORAGE_DECISIONS, []);
  const byCodigo = new Map();
  const byModulo = new Map();
  let aprobadas = 0;
  let rechazadas = 0;
  for (const r of arr) {
    if (r.tipo === 'aprobada') aprobadas += 1;
    if (r.tipo === 'rechazada') rechazadas += 1;
    const c = r.codigo || '—';
    byCodigo.set(c, (byCodigo.get(c) || 0) + 1);
    const m = r.modulo || '—';
    byModulo.set(m, (byModulo.get(m) || 0) + 1);
  }
  const top = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, count]) => ({ key: k, count }));
  return {
    version: HNF_MEMORY_VERSION,
    totalDecisiones: arr.length,
    aprobadas,
    rechazadas,
    topCodigos: top(byCodigo, 8),
    topModulos: top(byModulo, 8),
    ultimas: arr.slice(-12).reverse(),
  };
}

export function clearAutopilotMemory() {
  try {
    localStorage.removeItem(STORAGE_DECISIONS);
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} review
 * @param {string} [review.actor] - Romina / Lyn / operador
 * @param {string} [review.rol]
 * @param {string} [review.accion] - aprobacion | observacion | sugerencia
 * @param {string} [review.documentoId]
 * @param {string} [review.resumen]
 * @param {string[]} [review.patrones] - frases o reglas aprendidas
 */
export function rememberApprovalPattern(review) {
  const arr = readJson(STORAGE_DOC_APPROVAL, []);
  const row = {
    ...review,
    at: review.at || new Date().toISOString(),
    v: HNF_MEMORY_VERSION,
  };
  arr.push(row);
  writeJson(STORAGE_DOC_APPROVAL, arr.slice(-400));
  return row;
}

/** Resumen para Jarvis / paneles (criterio documental acumulado). */
export function getDocumentApprovalMemorySummary() {
  const arr = readJson(STORAGE_DOC_APPROVAL, []);
  const byActor = new Map();
  const byAccion = new Map();
  let patrones = 0;
  for (const r of arr) {
    const a = r.actor || '—';
    byActor.set(a, (byActor.get(a) || 0) + 1);
    const ac = r.accion || '—';
    byAccion.set(ac, (byAccion.get(ac) || 0) + 1);
    if (Array.isArray(r.patrones)) patrones += r.patrones.length;
  }
  const top = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));
  return {
    version: HNF_MEMORY_VERSION,
    totalEventos: arr.length,
    patronesTextoAcumulados: patrones,
    topActores: top(byActor, 6),
    topAcciones: top(byAccion, 6),
    ultimos: arr.slice(-15).reverse(),
  };
}
