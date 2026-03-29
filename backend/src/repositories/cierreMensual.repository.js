import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_cierres_mensuales.json');

let cache = null;

const nextId = (items) => {
  const n = items.reduce((max, x) => {
    const m = String(x.id || '').match(/^CM-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `CM-${String(n + 1).padStart(4, '0')}`;
};

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
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  cache = items;
}

export const cierreMensualRepository = {
  async findAll() {
    return load();
  },
  async findById(id) {
    const list = await load();
    return list.find((x) => x.id === id) || null;
  },
  async create(body, actor = 'sistema') {
    const list = await load();
    const id = nextId(list);
    const now = new Date().toISOString();
    const row = {
      id,
      periodo: String(body.periodo || '').slice(0, 7),
      estado: 'borrador',
      clienteId: body.clienteId != null ? String(body.clienteId).trim() || null : null,
      tiendaId: body.tiendaId != null ? String(body.tiendaId).trim() || null : null,
      tiendaNombreSnapshot: body.tiendaNombreSnapshot != null ? String(body.tiendaNombreSnapshot).slice(0, 200) : null,
      otIds: [],
      createdAt: now,
      updatedAt: now,
      historial: appendHistorial({ historial: [] }, 'alta', `Cierre mensual ${id}`, actor),
    };
    list.push(row);
    await save(list);
    return row;
  },
  async update(id, patch, actor = 'sistema', detalle = 'Actualización') {
    const list = await load();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const cur = list[i];
    const { otIds, estado, clienteId, tiendaId, tiendaNombreSnapshot, totales } = patch || {};
    const merged = {
      ...cur,
      ...(estado != null ? { estado: String(estado).toLowerCase() } : {}),
      ...(clienteId !== undefined ? { clienteId: clienteId ? String(clienteId).trim() : null } : {}),
      ...(tiendaId !== undefined ? { tiendaId: tiendaId ? String(tiendaId).trim() : null } : {}),
      ...(tiendaNombreSnapshot !== undefined
        ? { tiendaNombreSnapshot: tiendaNombreSnapshot ? String(tiendaNombreSnapshot).slice(0, 200) : null }
        : {}),
      ...(Array.isArray(otIds) ? { otIds: [...otIds] } : {}),
      ...(totales && typeof totales === 'object' ? { totales: { ...totales } } : {}),
      updatedAt: new Date().toISOString(),
      historial: appendHistorial(cur, 'cierre_mensual', String(detalle).slice(0, 500), actor),
    };
    list[i] = merged;
    await save(list);
    return merged;
  },
};
