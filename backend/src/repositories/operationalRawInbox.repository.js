import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_operational_raw_inbox.json');

let cache = null;

const defaultStore = () => ({ schemaVersion: '2026-03-24', items: [] });

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const p = JSON.parse(raw);
    cache = {
      schemaVersion: p.schemaVersion || '2026-03-24',
      items: Array.isArray(p.items) ? p.items : [],
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

const nextId = () => `raw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const operationalRawInboxRepository = {
  mode: 'json-file',

  async append(entry) {
    const store = await loadStore();
    const item = {
      id: nextId(),
      receivedAt: new Date().toISOString(),
      ...entry,
    };
    store.items.unshift(item);
    if (store.items.length > 2000) {
      store.items = store.items.slice(0, 2000);
    }
    await saveStore(store);
    return item;
  },

  async listRecent(limit = 100) {
    const store = await loadStore();
    return store.items.slice(0, limit);
  },

  async updateItem(id, patch) {
    const store = await loadStore();
    const idx = store.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    store.items[idx] = { ...store.items[idx], ...patch };
    await saveStore(store);
    return store.items[idx];
  },
};
