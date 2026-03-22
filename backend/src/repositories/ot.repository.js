import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
const dataFile = path.join(dataDir, 'ots.json');

let cache = null;

const parseMaxOtNumber = (items) =>
  items.reduce((max, item) => {
    const match = typeof item.id === 'string' ? item.id.match(/^OT-(\d+)$/i) : null;
    const n = match ? Number.parseInt(match[1], 10) : 0;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

const nextId = (items) => {
  const n = parseMaxOtNumber(items) + 1;
  return `OT-${String(n).padStart(3, '0')}`;
};

const ensureDefaults = (item) => ({
  ...item,
  pdfName: item.pdfName ?? null,
  pdfUrl: item.pdfUrl ?? null,
  fotografiasAntes: Array.isArray(item.fotografiasAntes) ? item.fotografiasAntes : [],
  fotografiasDurante: Array.isArray(item.fotografiasDurante) ? item.fotografiasDurante : [],
  fotografiasDespues: Array.isArray(item.fotografiasDespues) ? item.fotografiasDespues : [],
});

const loadStore = async () => {
  if (cache) return cache;

  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.map(ensureDefaults) : [];
  } catch {
    cache = [];
  }

  return cache;
};

const saveStore = async (items) => {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  cache = items;
};

export const otRepository = {
  mode: 'json-file',

  async findAll() {
    return loadStore();
  },

  async findById(id) {
    const items = await loadStore();
    return items.find((item) => item.id === id) || null;
  },

  async create(data) {
    const items = await loadStore();
    const item = ensureDefaults({
      id: nextId(items),
      ...data,
    });
    const next = [...items, item];
    await saveStore(next);
    return item;
  },

  async updateStatus(id, estado) {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated = { ...items[index], estado };
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async appendEvidences(id, patch) {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const current = items[index];
    const mergeBlock = (existing, incoming) => {
      const merged = [...(existing || [])];
      const names = new Set(merged.map((e) => e.name));
      for (const ev of incoming) {
        if (!names.has(ev.name)) {
          merged.push(ev);
          names.add(ev.name);
        }
      }
      return merged;
    };

    const updated = {
      ...current,
      fotografiasAntes: patch.fotografiasAntes
        ? mergeBlock(current.fotografiasAntes, patch.fotografiasAntes)
        : current.fotografiasAntes,
      fotografiasDurante: patch.fotografiasDurante
        ? mergeBlock(current.fotografiasDurante, patch.fotografiasDurante)
        : current.fotografiasDurante,
      fotografiasDespues: patch.fotografiasDespues
        ? mergeBlock(current.fotografiasDespues, patch.fotografiasDespues)
        : current.fotografiasDespues,
    };

    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateReport(id, { pdfName, pdfUrl }) {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated = { ...items[index], pdfName, pdfUrl };
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },
};
