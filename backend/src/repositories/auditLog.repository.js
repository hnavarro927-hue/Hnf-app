import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_audit_log.json');

let cache = null;
const MAX_ENTRIES = 5000;

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

export const auditLogRepository = {
  async append(entry) {
    const list = await load();
    const row = {
      id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      ...entry,
    };
    list.unshift(row);
    const trimmed = list.slice(0, MAX_ENTRIES);
    await save(trimmed);
    return row;
  },
  async findRecent(limit = 100) {
    const list = await load();
    return list.slice(0, Math.min(500, Number(limit) || 100));
  },
};
