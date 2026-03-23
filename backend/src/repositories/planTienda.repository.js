import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/plan_tiendas.json');

let cache = null;

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^TND-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `TND-${String(n + 1).padStart(3, '0')}`;
};

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.map(normalizeTienda) : [];
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

const normalizeHorario = (v) => {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v ?? '').trim();
};

const normalizeOrdenRuta = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 999;
};

const normalizeTienda = (t) => ({
  ...t,
  horarioAM: normalizeHorario(t.horarioAM),
  horarioPM: normalizeHorario(t.horarioPM),
  ordenRuta: normalizeOrdenRuta(t.ordenRuta),
  creadoPor: t.creadoPor ?? null,
  actualizadoPor: t.actualizadoPor ?? null,
  historial: Array.isArray(t.historial) ? t.historial : [],
});

export const planTiendaRepository = {
  async findAll(clienteId) {
    const items = await loadStore();
    if (!clienteId) return items;
    return items.filter((t) => t.clienteId === clienteId);
  },

  async findById(id) {
    const items = await loadStore();
    return items.find((t) => t.id === id) || null;
  },

  async create(payload, actor = 'sistema') {
    const items = await loadStore();
    const now = new Date().toISOString();
    const item = normalizeTienda({
      id: nextId(items),
      clienteId: String(payload.clienteId || '').trim(),
      nombre: String(payload.nombre || '').trim(),
      direccion: String(payload.direccion || '').trim(),
      comuna: String(payload.comuna || '').trim(),
      horarioAM: normalizeHorario(payload.horarioAM),
      horarioPM: normalizeHorario(payload.horarioPM),
      ordenRuta: normalizeOrdenRuta(payload.ordenRuta),
      estado: 'activo',
      createdAt: now,
      updatedAt: now,
      creadoPor: payload.creadoPor || actor,
      actualizadoPor: actor,
      historial: appendHistorial({}, 'alta', `Tienda creada: ${String(payload.nombre || '').trim()}`, actor),
    });
    const next = [...items, item];
    await saveStore(next);
    return item;
  },

  async update(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((t) => t.id === id);
    if (index === -1) return null;
    const cur = normalizeTienda(items[index]);
    const updated = {
      ...cur,
      ...('nombre' in patch ? { nombre: String(patch.nombre || '').trim() } : {}),
      ...('direccion' in patch ? { direccion: String(patch.direccion || '').trim() } : {}),
      ...('comuna' in patch ? { comuna: String(patch.comuna || '').trim() } : {}),
      ...('horarioAM' in patch ? { horarioAM: normalizeHorario(patch.horarioAM) } : {}),
      ...('horarioPM' in patch ? { horarioPM: normalizeHorario(patch.horarioPM) } : {}),
      ...('ordenRuta' in patch ? { ordenRuta: normalizeOrdenRuta(patch.ordenRuta) } : {}),
      updatedAt: new Date().toISOString(),
      actualizadoPor: actor,
      historial: appendHistorial(cur, 'edicion', 'Datos de tienda actualizados', actor),
    };
    const next = [...items];
    next[index] = normalizeTienda(updated);
    await saveStore(next);
    return updated;
  },
};
