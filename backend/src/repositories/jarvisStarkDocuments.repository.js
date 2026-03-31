import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/jarvis_stark_documents.json');
const MAX_ENTRIES = 8000;

let cache = null;

async function load() {
  if (cache) return cache;
  await mkdir(path.dirname(dataFile), { recursive: true });
  try {
    const raw = await readFile(dataFile, 'utf8');
    const j = JSON.parse(raw);
    cache = Array.isArray(j) ? j : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(items) {
  cache = items;
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

export const jarvisStarkDocumentsRepository = {
  async append(record) {
    const list = await load();
    list.unshift(record);
    const trimmed = list.slice(0, MAX_ENTRIES);
    await save(trimmed);
    return record;
  },

  async listRecent(limit = 200) {
    const list = await load();
    const n = Math.min(500, Math.max(1, Number(limit) || 200));
    return list.slice(0, n);
  },

  async findById(id) {
    const list = await load();
    return list.find((r) => r.id === id) || null;
  },
};
