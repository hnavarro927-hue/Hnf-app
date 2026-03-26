import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/operational_calendar.json');

let cache = null;

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^CAL-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `CAL-${String(n + 1).padStart(4, '0')}`;
};

const normalize = (e) => ({
  ...e,
  tiendaId: String(e.tiendaId || '').trim(),
  fecha: String(e.fecha || '').slice(0, 10),
  horaInicio: String(e.horaInicio ?? '').trim(),
  horaFin: String(e.horaFin ?? '').trim(),
  bloqueHorario: String(e.bloqueHorario ?? '').trim(),
  tipoUnidad: String(e.tipoUnidad || 'UE').trim(),
  tecnicoAsignado: String(e.tecnicoAsignado ?? '').trim(),
  estado: String(e.estado || 'programado').trim(),
  observacion: String(e.observacion ?? '').trim(),
  fuente: String(e.fuente || 'sistema').trim(),
  referenciaMantencionId: e.referenciaMantencionId ? String(e.referenciaMantencionId).trim() : null,
  referenciaOtId: e.referenciaOtId ? String(e.referenciaOtId).trim() : null,
  cliente: String(e.cliente ?? '').trim(),
  tiendaNombre: String(e.tiendaNombre ?? '').trim(),
});

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const p = JSON.parse(raw);
    cache = Array.isArray(p) ? p.map(normalize) : [];
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

export const operationalCalendarRepository = {
  async findAll() {
    return (await loadStore()).map(normalize);
  },

  async findInRange(desde, hasta) {
    const d0 = String(desde || '').slice(0, 10);
    const d1 = String(hasta || '').slice(0, 10);
    const items = await loadStore();
    return items
      .filter((e) => {
        const f = String(e.fecha || '').slice(0, 10);
        return f >= d0 && f <= d1;
      })
      .map(normalize);
  },

  async findById(id) {
    const items = await loadStore();
    const x = items.find((e) => e.id === id);
    return x ? normalize(x) : null;
  },

  async create(payload, actor = 'sistema') {
    const items = await loadStore();
    const now = new Date().toISOString();
    const row = normalize({
      ...payload,
      id: nextId(items),
      createdAt: now,
      updatedAt: now,
      creadoPor: payload.creadoPor || actor,
      actualizadoPor: actor,
    });
    await saveStore([...items, row]);
    return row;
  },

  async update(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const cur = normalize(items[idx]);
    const next = normalize({ ...cur, ...patch, id: cur.id, updatedAt: new Date().toISOString(), actualizadoPor: actor });
    const copy = [...items];
    copy[idx] = next;
    await saveStore(copy);
    return next;
  },
};
