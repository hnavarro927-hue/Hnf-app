import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_operational_events.json');

let cache = null;

const defaultStore = () => ({ schemaVersion: '2026-03-24', events: [] });

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const p = JSON.parse(raw);
    cache = {
      schemaVersion: p.schemaVersion || '2026-03-24',
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

const nextId = () => `hoe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const operationalEventRepository = {
  mode: 'json-file',

  async list() {
    const { events } = await loadStore();
    return [...events].sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  },

  async findById(id) {
    const { events } = await loadStore();
    return events.find((e) => e.id === id) || null;
  },

  async findByWhatsappMessageId(waId) {
    if (!waId) return null;
    const { events } = await loadStore();
    return events.find((e) => e.whatsapp_message_id === waId) || null;
  },

  /**
   * @param {object} event - documento completo
   */
  async upsert(event) {
    const store = await loadStore();
    const idx = store.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      store.events[idx] = event;
    } else {
      store.events.unshift(event);
    }
    if (store.events.length > 5000) {
      store.events = store.events.slice(0, 5000);
    }
    await saveStore(store);
    return event;
  },

  async insertNew(doc) {
    const store = await loadStore();
    const event = { ...doc, id: doc.id || nextId() };
    store.events.unshift(event);
    if (store.events.length > 5000) {
      store.events = store.events.slice(0, 5000);
    }
    await saveStore(store);
    return event;
  },
};
