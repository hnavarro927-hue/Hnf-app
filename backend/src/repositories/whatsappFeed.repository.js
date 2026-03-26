import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/whatsapp_feed.json');

let cache = null;

const defaultStore = () => ({ messages: [], ingestLogs: [], errors: [] });

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const p = JSON.parse(raw);
    cache = {
      messages: Array.isArray(p.messages) ? p.messages : [],
      ingestLogs: Array.isArray(p.ingestLogs) ? p.ingestLogs : [],
      errors: Array.isArray(p.errors) ? p.errors : [],
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

const nextWaId = (messages) => {
  const n = messages.reduce((max, m) => {
    const x = typeof m.id === 'string' ? m.id.match(/^WA-(\d+)$/i) : null;
    const v = x ? Number.parseInt(x[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `WA-${String(n + 1).padStart(4, '0')}`;
};

export const whatsappFeedRepository = {
  mode: 'json-file',

  async getAll() {
    return loadStore();
  },

  async findByHash(hash) {
    const { messages } = await loadStore();
    return messages.find((m) => m.hashContenido === hash) || null;
  },

  async appendFeedError(entry) {
    const store = await loadStore();
    if (!Array.isArray(store.errors)) store.errors = [];
    store.errors.push({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
    if (store.errors.length > 800) {
      store.errors = store.errors.slice(-800);
    }
    await saveStore(store);
    return entry;
  },

  async appendLog(entry) {
    const store = await loadStore();
    store.ingestLogs.push({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });
    if (store.ingestLogs.length > 500) {
      store.ingestLogs = store.ingestLogs.slice(-500);
    }
    await saveStore(store);
    return entry;
  },

  async saveMessage(record) {
    const store = await loadStore();
    const idx = store.messages.findIndex((m) => m.id === record.id);
    if (idx === -1) {
      store.messages.push(record);
    } else {
      store.messages[idx] = record;
    }
    await saveStore(store);
    return record;
  },

  async createMessage(record) {
    const store = await loadStore();
    const id = record.id || nextWaId(store.messages);
    const full = { ...record, id, createdAt: record.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    store.messages.push(full);
    await saveStore(store);
    return full;
  },

  nextId(messages) {
    return nextWaId(messages);
  },
};
