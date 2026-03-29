import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_oc_detalle_tienda.json');

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

const nextId = (items) => {
  const n = items.reduce((max, x) => {
    const m = String(x.id || '').match(/^OCT-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `OCT-${String(n + 1).padStart(5, '0')}`;
};

export const ocDetalleTiendaRepository = {
  async findAll() {
    return load();
  },
  async findById(id) {
    const list = await load();
    return list.find((x) => x.id === id) || null;
  },
  async findByCabeceraId(cabeceraId) {
    const list = await load();
    return list.filter((x) => x.cabeceraId === cabeceraId);
  },
  async insertManyForCabecera(cabeceraId, rows, actor) {
    const list = await load();
    const now = new Date().toISOString();
    const created = [];
    for (const row of rows) {
      const id = nextId(list);
      const item = {
        ...row,
        id,
        cabeceraId,
        createdAt: now,
        updatedAt: now,
        historial: appendHistorial({ historial: [] }, 'alta_oc_detalle', `Detalle ${id} cabecera ${cabeceraId}`, actor),
      };
      list.push(item);
      created.push(item);
    }
    await save(list);
    return created;
  },
  async update(id, patch, actor, detalle = 'Actualización detalle OC') {
    const list = await load();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const cur = list[i];
    const merged = {
      ...cur,
      ...patch,
      updatedAt: new Date().toISOString(),
      historial: appendHistorial(cur, 'oc_detalle', String(detalle).slice(0, 500), actor),
    };
    list[i] = merged;
    await save(list);
    return merged;
  },
};
