/**
 * Memoria operativa local (fase 1): patrones y notas por cliente para futura IA / app móvil.
 * Persistencia: localStorage. Sin PII fuera del dispositivo.
 *
 * Evolución prevista: sincronizar vía API, agregados por tipo de trabajo, productividad por técnico.
 */

export const BUSINESS_MEMORY_SCHEMA = 'hnf.businessMemory';
export const BUSINESS_MEMORY_VERSION = '1';

const STORAGE_KEY = 'hnf.businessMemory.v1';

const defaultMemory = () => ({
  schema: BUSINESS_MEMORY_SCHEMA,
  version: BUSINESS_MEMORY_VERSION,
  updatedAt: null,
  /** @type {Record<string, { preferredSlot?: 'AM' | 'PM' | ''; avgVisitHours?: number; notes?: string; lastSeenAt?: string }>} */
  byCliente: {},
  /** @type {Record<string, { samples: number; sumHours: number }>} */
  jobTypeStats: {},
});

export const loadBusinessMemory = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== BUSINESS_MEMORY_VERSION) return defaultMemory();
    return { ...defaultMemory(), ...parsed, byCliente: parsed.byCliente || {}, jobTypeStats: parsed.jobTypeStats || {} };
  } catch {
    return defaultMemory();
  }
};

export const saveBusinessMemory = (mem) => {
  const next = { ...mem, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

/**
 * Registra o fusiona hint por nombre de cliente (clave normalizada).
 */
export const upsertClienteHint = (clienteNombre, partial) => {
  const key = normalizeClienteKey(clienteNombre);
  if (!key) return loadBusinessMemory();
  const mem = loadBusinessMemory();
  const prev = mem.byCliente[key] || {};
  mem.byCliente[key] = { ...prev, ...partial };
  return saveBusinessMemory(mem);
};

export const normalizeClienteKey = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120);

export const getClienteHint = (clienteNombre) => {
  const mem = loadBusinessMemory();
  const k = normalizeClienteKey(clienteNombre);
  return k ? mem.byCliente[k] : null;
};

/**
 * Actualiza promedio móvil simple de horas por tipo de servicio (OT cerradas).
 * @param {string} tipoServicio
 * @param {number} hours — horas entre alta y cierre, si confiables
 */
export const recordJobTypeDuration = (tipoServicio, hours) => {
  const tipo = String(tipoServicio || 'otros').trim() || 'otros';
  const h = Number(hours);
  if (!Number.isFinite(h) || h < 0 || h > 720) return loadBusinessMemory();
  const mem = loadBusinessMemory();
  const cur = mem.jobTypeStats[tipo] || { samples: 0, sumHours: 0 };
  cur.samples += 1;
  cur.sumHours += h;
  mem.jobTypeStats[tipo] = cur;
  return saveBusinessMemory(mem);
};

export const getJobTypeAverageHours = (tipoServicio) => {
  const mem = loadBusinessMemory();
  const tipo = String(tipoServicio || 'otros').trim() || 'otros';
  const cur = mem.jobTypeStats[tipo];
  if (!cur || cur.samples < 1) return null;
  return cur.sumHours / cur.samples;
};
