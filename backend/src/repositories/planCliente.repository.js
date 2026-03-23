import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/plan_clientes.json');

let cache = null;

const normalizeCliente = (c) => ({
  ...c,
  estado: String(c.estado || 'activo').trim(),
  createdAt: c.createdAt || null,
  updatedAt: c.updatedAt || c.createdAt || null,
  historial: Array.isArray(c.historial) ? c.historial : [],
});

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^CLI-P-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `CLI-P-${String(n + 1).padStart(3, '0')}`;
};

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.map(normalizeCliente) : [];
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

export const planClienteRepository = {
  async findAll() {
    return loadStore();
  },

  async findById(id) {
    const items = await loadStore();
    return items.find((c) => c.id === id) || null;
  },

  async create({ nombre }) {
    const items = await loadStore();
    const now = new Date().toISOString();
    const item = normalizeCliente({
      id: nextId(items),
      nombre: String(nombre || '').trim(),
      estado: 'activo',
      createdAt: now,
      updatedAt: now,
      historial: appendHistorial({}, 'alta', 'Cliente de planificación creado'),
    });
    const next = [...items, item];
    await saveStore(next);
    return item;
  },
};
