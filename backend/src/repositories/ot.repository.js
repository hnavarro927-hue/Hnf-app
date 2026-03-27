import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHistorial } from '../utils/historialUtil.js';

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

const round2 = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

const computeOtEconomics = (item) => {
  const cm = round2(item.costoMateriales);
  const mo = round2(item.costoManoObra);
  const tr = round2(item.costoTraslado);
  const ot = round2(item.costoOtros);
  const costoTotal = round2(cm + mo + tr + ot);
  const montoCobrado = round2(item.montoCobrado);
  const utilidad = round2(montoCobrado - costoTotal);
  return { ...item, costoMateriales: cm, costoManoObra: mo, costoTraslado: tr, costoOtros: ot, costoTotal, montoCobrado, utilidad };
};

const normalizeOperationMode = (v) => (v === 'automatic' ? 'automatic' : 'manual');

const deriveResponsable = (item) => {
  const t = String(item?.tecnicoAsignado || '').trim();
  if (item?.responsableActual != null && String(item.responsableActual).trim()) {
    return String(item.responsableActual).trim();
  }
  if (t && t !== 'Por asignar') return t;
  return null;
};

const ensureDefaults = (item) => {
  const now = new Date().toISOString();
  const creado = item.creadoEn || item.createdAt || null;
  const base = {
    ...item,
    operationMode: normalizeOperationMode(item.operationMode),
    origenPedido: String(item.origenPedido ?? '').trim(),
    asignadoPor: item.asignadoPor != null && String(item.asignadoPor).trim() ? String(item.asignadoPor).trim() : null,
    responsableActual: deriveResponsable(item),
    pdfName: item.pdfName ?? null,
    pdfUrl: item.pdfUrl ?? null,
    creadoEn: item.creadoEn ?? null,
    cerradoEn: item.cerradoEn ?? null,
    createdAt: item.createdAt || creado || null,
    updatedAt: item.updatedAt || creado || now,
    creadoPor: item.creadoPor ?? null,
    actualizadoPor: item.actualizadoPor ?? null,
    historial: Array.isArray(item.historial) ? item.historial : [],
    equipos: Array.isArray(item.equipos) ? item.equipos : [],
    fotografiasAntes: Array.isArray(item.fotografiasAntes) ? item.fotografiasAntes : [],
    fotografiasDurante: Array.isArray(item.fotografiasDurante) ? item.fotografiasDurante : [],
    fotografiasDespues: Array.isArray(item.fotografiasDespues) ? item.fotografiasDespues : [],
    costoMateriales: item.costoMateriales ?? 0,
    costoManoObra: item.costoManoObra ?? 0,
    costoTraslado: item.costoTraslado ?? 0,
    costoOtros: item.costoOtros ?? 0,
    montoCobrado: item.montoCobrado ?? 0,
  };
  return computeOtEconomics(base);
};

const touch = (item, accion, detalle, actor = 'sistema') => ({
  ...item,
  updatedAt: new Date().toISOString(),
  actualizadoPor: actor,
  historial: appendHistorial(item, accion, detalle, actor),
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

  async create(data, actor = 'sistema') {
    const items = await loadStore();
    const now = new Date().toISOString();
    const requestedId = data.id != null ? String(data.id).trim() : '';
    const id = requestedId || nextId(items);
    if (items.some((x) => x.id === id)) {
      return { error: 'DUPLICATE_ID', id };
    }

    const { id: _dropId, ...rest } = data;
    const mode = normalizeOperationMode(rest.operationMode);
    const item = ensureDefaults({
      id,
      ...rest,
      operationMode: mode,
      creadoEn: rest.creadoEn || now,
      createdAt: rest.createdAt || rest.creadoEn || now,
      updatedAt: now,
      creadoPor: actor,
      actualizadoPor: actor,
      historial: appendHistorial(
        {},
        'alta',
        `OT creada · ${rest.estado || 'pendiente'} · modo ${mode}`,
        actor
      ),
    });
    const next = [...items, item];
    await saveStore(next);
    return item;
  },

  async patchOperational(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]) };
    const p = patch || {};

    if ('operationMode' in p) {
      const m = normalizeOperationMode(p.operationMode);
      if (m !== updated.operationMode) {
        updated.operationMode = m;
        updated = touch(updated, 'operacion', `Modo operación → ${m}`, actor);
      }
    }

    if ('tecnicoAsignado' in p) {
      const t = String(p.tecnicoAsignado ?? '').trim() || 'Por asignar';
      updated.tecnicoAsignado = t;
      updated.asignadoPor = actor;
      if ('responsableActual' in p && p.responsableActual != null) {
        const r = String(p.responsableActual).trim();
        updated.responsableActual = r || null;
      } else {
        updated.responsableActual = t === 'Por asignar' ? null : t;
      }
      updated = touch(updated, 'asignacion', `Técnico asignado → ${t}`, actor);
    } else if ('responsableActual' in p) {
      const r = String(p.responsableActual ?? '').trim();
      updated.responsableActual = r || null;
      updated = touch(updated, 'responsable', `Responsable actual → ${r || '—'}`, actor);
    }

    if ('origenPedido' in p) {
      updated.origenPedido = String(p.origenPedido ?? '').trim();
      updated = touch(updated, 'origen', 'Origen del pedido actualizado', actor);
    }

    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateStatus(id, estado, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const prev = ensureDefaults(items[index]);
    let updated = { ...prev, estado };
    if (estado === 'terminado') {
      updated.cerradoEn = new Date().toISOString();
    } else if (prev.estado === 'terminado' && estado !== 'terminado') {
      updated.cerradoEn = null;
    }
    updated = touch(updated, 'estado', `${prev.estado} → ${estado}`, actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateVisitFields(id, fields, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const cur = ensureDefaults(items[index]);
    const updated = { ...cur };
    if ('resumenTrabajo' in fields) {
      updated.resumenTrabajo = String(fields.resumenTrabajo ?? '').trim();
    }
    if ('recomendaciones' in fields) {
      updated.recomendaciones = String(fields.recomendaciones ?? '').trim();
    }
    if ('observaciones' in fields) {
      updated.observaciones = String(fields.observaciones ?? '').trim();
    }
    let out = touch(updated, 'visita', 'Textos de visita actualizados', actor);
    out = ensureDefaults(out);
    const next = [...items];
    next[index] = out;
    await saveStore(next);
    return out;
  },

  async updateEconomics(id, fields, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const cur = ensureDefaults(items[index]);
    const updated = { ...cur };
    for (const k of ['costoMateriales', 'costoManoObra', 'costoTraslado', 'costoOtros', 'montoCobrado']) {
      if (k in fields) updated[k] = round2(fields[k]);
    }
    let out = touch(updated, 'economia', 'Costos / ingreso actualizados', actor);
    out = ensureDefaults(out);
    const next = [...items];
    next[index] = out;
    await saveStore(next);
    return out;
  },

  async appendEvidences(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const current = ensureDefaults(items[index]);
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

    let updated = {
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
    updated = touch(updated, 'evidencias', 'Fotos agregadas', actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateReport(id, { pdfName, pdfUrl }, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]), pdfName, pdfUrl };
    updated = touch(updated, 'informe', 'PDF asociado a la OT', actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },

  async updateEquipos(id, equipos, actor = 'sistema') {
    const items = await loadStore();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    let updated = { ...ensureDefaults(items[index]), equipos };
    updated = touch(updated, 'equipos', 'Equipos / checklist / evidencias actualizados', actor);
    updated = ensureDefaults(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },
};
