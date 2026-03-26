import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/jarvis_operative_events.json');

let cache = null;

const defaultStore = () => ({ events: [] });

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const p = JSON.parse(raw);
    cache = {
      events: Array.isArray(p.events) ? p.events : [],
    };
  } catch {
    cache = defaultStore();
  }
  return cache;
};

const saveStore = async (store) => {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  cache = store;
};

const nextId = () => `jev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const jarvisOperativeEventsRepository = {
  mode: 'json-file',

  async list() {
    const { events } = await loadStore();
    return [...events].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },

  /**
   * @param {object} payload - campos desde cliente (sin id obligatorio)
   */
  async append(payload) {
    const store = await loadStore();
    const at = payload.at && String(payload.at).trim() ? payload.at : new Date().toISOString();
    const ev = {
      id: nextId(),
      at,
      version: '2026-03-24',
      rawExcerpt: String(payload.rawExcerpt || '').slice(0, 2000),
      tipoClasificado: payload.tipoClasificado || 'documento',
      prioridad: payload.prioridad || 'NORMAL',
      clienteDetectado: payload.clienteDetectado ?? null,
      responsableSugerido: payload.responsableSugerido || 'sin dueño',
      impactoEconomicoHeuristico: Number(payload.impactoEconomicoHeuristico) || 0,
      accionInmediata: String(payload.accionInmediata || '').slice(0, 2000),
      canalSalida: payload.canalSalida || payload.canal || 'manual',
      tipoSalida: payload.tipoSalida || null,
      fuente: payload.fuente || 'hq',
      archivo: payload.archivo || null,
      persistencia: 'servidor',
      ...sanitizeExtra(payload),
    };
    store.events.unshift(ev);
    if (store.events.length > 500) {
      store.events = store.events.slice(0, 500);
    }
    await saveStore(store);
    return ev;
  },
};

function sanitizeExtra(payload) {
  const allow = ['generaIngreso', 'generaRiesgo', 'generaOportunidad', 'vinculoSugerido', 'kind'];
  const out = {};
  for (const k of allow) {
    if (payload[k] !== undefined) out[k] = payload[k];
  }
  return out;
}
