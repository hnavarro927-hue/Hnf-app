import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../../data/outlook_feed.json');

let cache = null;

const defaultStore = () => ({
  version: '2026-03-23',
  messages: [],
  historicalImports: [],
  ingestErrors: [],
  lastIngestAt: null,
  futureOutlookHooks: {
    inboxSync: false,
    replyDraft: false,
    threadSync: false,
    sendMail: false,
    autoReply: false,
    outboundSync: false,
    note: 'READ_ONLY — sin envío ni API Outlook real. Solo recepción / ingesta.',
  },
});

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const p = JSON.parse(raw);
    cache = {
      ...defaultStore(),
      ...p,
      messages: Array.isArray(p.messages) ? p.messages : [],
      historicalImports: Array.isArray(p.historicalImports) ? p.historicalImports : [],
      ingestErrors: Array.isArray(p.ingestErrors) ? p.ingestErrors : [],
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

const nextOlId = (messages) => {
  const n = messages.reduce((max, m) => {
    const x = typeof m.id === 'string' ? m.id.match(/^OL-(\d+)$/i) : null;
    const v = x ? Number.parseInt(x[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `OL-${String(n + 1).padStart(4, '0')}`;
};

export const outlookIntakeRepository = {
  mode: 'json-file',

  async getAll() {
    return loadStore();
  },

  async findByContentHash(hash) {
    const { messages } = await loadStore();
    return messages.find((m) => m.contentHash === hash) || null;
  },

  async appendMessage(record) {
    const store = await loadStore();
    store.messages.push(record);
    if (store.messages.length > 2000) {
      store.messages = store.messages.slice(-2000);
    }
    store.lastIngestAt = new Date().toISOString();
    await saveStore(store);
    return record;
  },

  async appendHistoricalImport(entry) {
    const store = await loadStore();
    store.historicalImports.push(entry);
    if (store.historicalImports.length > 200) {
      store.historicalImports = store.historicalImports.slice(-200);
    }
    store.lastIngestAt = new Date().toISOString();
    await saveStore(store);
    return entry;
  },

  async appendIngestError(entry) {
    const store = await loadStore();
    store.ingestErrors.push({
      ...entry,
      at: entry.at || new Date().toISOString(),
    });
    if (store.ingestErrors.length > 400) {
      store.ingestErrors = store.ingestErrors.slice(-400);
    }
    await saveStore(store);
    return entry;
  },

  nextId(messages) {
    return nextOlId(messages);
  },
};
