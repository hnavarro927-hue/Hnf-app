import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_tiendas_financieras.json');

let cache = null;

const nextId = (items) => {
  const n = items.reduce((max, x) => {
    const m = String(x.id || '').match(/^TND-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `TND-${String(n + 1).padStart(4, '0')}`;
};

const round2 = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const ensure = (row) => ({
  ...row,
  nombre: String(row.nombre || '').slice(0, 200) || 'Sin nombre',
  clienteId: row.clienteId != null && String(row.clienteId).trim() ? String(row.clienteId).trim() : null,
  costoBaseTienda: round2(row.costoBaseTienda ?? 0),
  valorReferencialTienda: round2(row.valorReferencialTienda ?? 0),
  observacionFinanciera: String(row.observacionFinanciera || '').slice(0, 2000),
  historialCambios: Array.isArray(row.historialCambios) ? row.historialCambios : [],
  historial: Array.isArray(row.historial) ? row.historial : [],
});

async function load() {
  if (cache) return cache;
  await mkdir(path.dirname(dataFile), { recursive: true });
  try {
    const raw = await readFile(dataFile, 'utf8');
    const j = JSON.parse(raw);
    cache = Array.isArray(j) ? j.map(ensure) : [];
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

export const tiendaFinancieraRepository = {
  async findAll() {
    return load();
  },
  async findById(id) {
    const list = await load();
    return list.find((x) => x.id === id) || null;
  },
  async findByClienteId(clienteId) {
    const cid = String(clienteId || '').trim();
    if (!cid) return [];
    const list = await load();
    return list.filter((x) => x.clienteId && String(x.clienteId) === cid);
  },
  async create(body, actor = 'sistema') {
    const list = await load();
    const id = nextId(list);
    const now = new Date().toISOString();
    const row = ensure({
      id,
      ...body,
      createdAt: now,
      updatedAt: now,
      historial: appendHistorial({ historial: [] }, 'alta', `Tienda financiera ${id}`, actor),
    });
    list.push(row);
    await save(list);
    return row;
  },
  async update(id, patch, actor = 'sistema') {
    const list = await load();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const cur = list[i];
    const cambios = [];
    for (const k of ['costoBaseTienda', 'valorReferencialTienda', 'observacionFinanciera', 'nombre', 'clienteId']) {
      if (k in patch && patch[k] !== undefined) {
        const prev = cur[k];
        const next = k === 'nombre' ? String(patch[k]).slice(0, 200) : patch[k];
        if (JSON.stringify(prev) !== JSON.stringify(next)) {
          cambios.push({ campo: k, anterior: prev, nuevo: next, at: new Date().toISOString(), actor });
        }
      }
    }
    const merged = ensure({
      ...cur,
      ...patch,
      historialCambios: [...(cur.historialCambios || []), ...cambios].slice(-200),
      updatedAt: new Date().toISOString(),
      historial: appendHistorial(cur, 'edicion', 'Maestro tienda actualizado', actor),
    });
    list[i] = merged;
    await save(list);
    return merged;
  },
};
