import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/plan_mantenciones.json');

let cache = null;

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^MNT-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `MNT-${String(n + 1).padStart(3, '0')}`;
};

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
};

const saveStore = async (items) => {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  cache = items;
};

export const planMantencionRepository = {
  async findAll(filters = {}) {
    let items = await loadStore();
    if (filters.fecha) {
      items = items.filter((m) => m.fecha === filters.fecha);
    }
    if (filters.tecnico) {
      const t = String(filters.tecnico).trim().toLowerCase();
      items = items.filter((m) => String(m.tecnico || '').toLowerCase().includes(t));
    }
    return items;
  },

  async findById(id) {
    const items = await loadStore();
    return items.find((m) => m.id === id) || null;
  },

  async create(payload) {
    const items = await loadStore();
    const item = {
      id: nextId(items),
      tiendaId: String(payload.tiendaId || '').trim(),
      fecha: String(payload.fecha || '').trim(),
      tecnico: String(payload.tecnico || '').trim(),
      tipo: String(payload.tipo || 'preventivo').trim(),
      estado: String(payload.estado || 'programado').trim(),
    };
    const next = [...items, item];
    await saveStore(next);
    return item;
  },

  async update(id, patch) {
    const items = await loadStore();
    const index = items.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const cur = items[index];
    const updated = { ...cur };
    if ('fecha' in patch) updated.fecha = String(patch.fecha || '').trim();
    if ('tecnico' in patch) updated.tecnico = String(patch.tecnico || '').trim();
    if ('tipo' in patch) updated.tipo = String(patch.tipo || '').trim();
    if ('estado' in patch) updated.estado = String(patch.estado || '').trim();
    if ('tiendaId' in patch) updated.tiendaId = String(patch.tiendaId || '').trim();
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },
};
