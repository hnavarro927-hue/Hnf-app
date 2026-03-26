import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';
import {
  HNF_CORE_ETAPAS_CHECKLIST,
  HNF_CORE_ESTADOS,
  HNF_CORE_ORIGENES,
  HNF_CORE_TIPOS,
} from '../models/hnfCoreSolicitud.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_core_solicitudes.json');

let cache = null;

const defaultChecklist = () =>
  Object.fromEntries(HNF_CORE_ETAPAS_CHECKLIST.map((k) => [k, false]));

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^HNF-SOL-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `HNF-SOL-${String(n + 1).padStart(4, '0')}`;
};

const readAll = async () => {
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
};

const writeAll = async (items) => {
  cache = items;
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
};

export const normalizeHnfCoreSolicitud = (raw) => {
  const now = new Date().toISOString();
  const checklist = { ...defaultChecklist(), ...(raw.checklist && typeof raw.checklist === 'object' ? raw.checklist : {}) };
  for (const k of HNF_CORE_ETAPAS_CHECKLIST) {
    if (!(k in checklist)) checklist[k] = false;
  }
  let estado = String(raw.estado || 'recibido').toLowerCase().replace(/\s+/g, '_');
  if (estado === 'pendiente_aprobación' || estado === 'pendienteaprobacion') estado = 'pendiente_aprobacion';
  if (!HNF_CORE_ESTADOS.includes(estado)) estado = 'recibido';

  let tipo = String(raw.tipo || 'clima').toLowerCase();
  if (!HNF_CORE_TIPOS.includes(tipo)) tipo = 'clima';

  let origen = String(raw.origen || 'manual').toLowerCase();
  if (!HNF_CORE_ORIGENES.includes(origen)) origen = 'manual';

  let prioridad = String(raw.prioridad || 'media').toLowerCase();
  if (!['baja', 'media', 'alta', 'critica', 'crítica'].includes(prioridad)) prioridad = 'media';
  if (prioridad === 'crítica') prioridad = 'critica';

  return {
    ...raw,
    id: raw.id,
    cliente: String(raw.cliente || '').trim(),
    tipo,
    origen,
    fecha: String(raw.fecha || now).trim(),
    responsable: String(raw.responsable || '').trim(),
    estado,
    prioridad,
    descripcion: String(raw.descripcion ?? '').trim(),
    checklist,
    historial: Array.isArray(raw.historial) ? raw.historial : [],
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
};

export const hnfCoreSolicitudRepository = {
  async findAll(filters = {}) {
    let list = await readAll();
    if (filters.tipo) list = list.filter((x) => x.tipo === filters.tipo);
    if (filters.estado) list = list.filter((x) => x.estado === filters.estado);
    if (filters.responsable) {
      const r = String(filters.responsable).toLowerCase();
      list = list.filter((x) => String(x.responsable || '').toLowerCase().includes(r));
    }
    if (filters.origen) list = list.filter((x) => x.origen === filters.origen);
    list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return list;
  },

  async findById(id) {
    const list = await readAll();
    return list.find((x) => x.id === id) || null;
  },

  async create(payload, actor) {
    const list = await readAll();
    const id = nextId(list);
    const now = new Date().toISOString();
    let row = normalizeHnfCoreSolicitud({ ...payload, id, createdAt: now, updatedAt: now });
    row = {
      ...row,
      historial: appendHistorial(row, 'alta', `Solicitud creada · ${row.tipo} · ${row.origen}`, actor),
    };
    list.push(row);
    await writeAll(list);
    return row;
  },

  async update(id, patch, historialEntry, actor) {
    const list = await readAll();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const cur = list[i];
    const merged = normalizeHnfCoreSolicitud({
      ...cur,
      ...patch,
      checklist: { ...cur.checklist, ...(patch.checklist || {}) },
      updatedAt: new Date().toISOString(),
    });
    if (historialEntry) {
      merged.historial = appendHistorial(
        merged,
        historialEntry.accion,
        historialEntry.detalle,
        actor
      );
    }
    list[i] = merged;
    await writeAll(list);
    return merged;
  },
};
