import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../../data/historical_vault.json');

let cache = null;

const HISTORICAL_VAULT_VERSION = '2026-03-23';

const defaultStore = () => ({
  version: HISTORICAL_VAULT_VERSION,
  records: [],
  importBatches: [],
  lastIngestAt: null,
});

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const p = JSON.parse(raw);
    cache = {
      ...defaultStore(),
      ...p,
      records: Array.isArray(p.records) ? p.records : [],
      importBatches: Array.isArray(p.importBatches) ? p.importBatches : [],
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

export const historicalVaultRepository = {
  async getAll() {
    return loadStore();
  },

  async appendRecords(newRecords) {
    const store = await loadStore();
    const seen = new Set(store.records.map((r) => r.hash).filter(Boolean));
    let added = 0;
    for (const rec of newRecords) {
      if (!rec.hash || seen.has(rec.hash)) continue;
      seen.add(rec.hash);
      store.records.push(rec);
      added += 1;
    }
    if (store.records.length > 5000) {
      store.records = store.records.slice(-5000);
    }
    store.lastIngestAt = new Date().toISOString();
    await saveStore(store);
    return { added, total: store.records.length };
  },

  async appendBatch(batchEntry) {
    const store = await loadStore();
    store.importBatches.push(batchEntry);
    if (store.importBatches.length > 200) {
      store.importBatches = store.importBatches.slice(-200);
    }
    await saveStore(store);
    return batchEntry;
  },
};
