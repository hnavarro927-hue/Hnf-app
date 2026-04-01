/**
 * Solicitudes Flota — fuente única de verdad: `backend/data/flota_solicitudes.json`.
 * Lectura siempre desde disco; escritura atómica (tmp + rename) y cola exclusiva anti-carrera.
 */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costoTotalOperativo, utilidadOperativa } from '../domain/flota-solicitud-economics.js';
import { solicitudFlotaModel } from '../models/solicitudFlota.model.js';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/flota_solicitudes.json');

const LOG_PREFIX = '[HNF flota/solicitudes store]';

/** Serializa todas las lecturas/escrituras para evitar pérdida por carreras concurrentes. */
let storeChain = Promise.resolve();
const withStoreLock = async (fn) => {
  const run = storeChain.then(() => fn());
  storeChain = run.then(
    () => {},
    () => {}
  );
  return run;
};

const NEW_ESTADOS = new Set(solicitudFlotaModel.estados);

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^SF-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `SF-${String(n + 1).padStart(3, '0')}`;
};

const round2 = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

const LEGACY_ESTADO = {
  pendiente: 'recibida',
  en_proceso: 'evaluacion',
  en_gestion: 'evaluacion',
  terminado: 'completada',
  facturado: 'cerrada',
};

const migrateEstado = (e) => {
  const s = String(e || '').trim();
  if (NEW_ESTADOS.has(s)) return s;
  return LEGACY_ESTADO[s] || 'recibida';
};

const migrateTipoServicio = (raw) => {
  const t = String(raw?.tipoServicio || raw?.tipo || '').trim();
  if (t === 'traslado') return 'traslado';
  if (t === 'asistencia') return 'asistencia';
  if (t === 'otro') return 'otro';
  if (t === 'mantencion') return 'asistencia';
  if (t === 'emergencia') return 'otro';
  return 'traslado';
};

export const normalizeSolicitudShape = (s) => {
  const tipoServicio = migrateTipoServicio(s);
  const estado = migrateEstado(s.estado);
  const now = new Date().toISOString();
  const createdAt = s.createdAt || s.creadoEn || now;
  const base = {
    ...s,
    cliente: String(s.cliente || '').trim(),
    tipoServicio,
    fecha: String(s.fecha || '').trim(),
    hora: String(s.hora ?? '').trim(),
    origen: String(s.origen ?? '').trim(),
    destino: String(s.destino ?? '').trim(),
    conductor: String(s.conductor ?? '').trim(),
    vehiculo: String(s.vehiculo ?? '').trim(),
    estado,
    detalle: String(s.detalle ?? '').trim(),
    responsable: String(s.responsable ?? '').trim(),
    observacion: String(s.observacion ?? '').trim(),
    observacionCierre: String(s.observacionCierre ?? '').trim(),
    costoCombustible: round2(s.costoCombustible),
    costoPeaje: round2(s.costoPeaje),
    costoChofer: round2(s.costoChofer),
    costoExterno: round2(s.costoExterno),
    materiales: round2(s.materiales),
    manoObra: round2(s.manoObra),
    costoTraslado: round2(s.costoTraslado),
    otros: round2(s.otros),
    ingresoEstimado: round2(s.ingresoEstimado),
    ingresoFinal: round2(s.ingresoFinal),
    montoCobrado: round2(s.montoCobrado),
    monto: round2(s.monto),
    historial: Array.isArray(s.historial) ? s.historial : [],
    creadoPor: s.creadoPor ?? null,
    actualizadoPor: s.actualizadoPor ?? null,
    createdAt,
    updatedAt: s.updatedAt || now,
  };

  if (!base.hora && base.fecha) base.hora = '09:00';
  if (!base.origen) base.origen = '—';
  if (!base.destino) base.destino = '—';
  if (!base.conductor) base.conductor = 'Por asignar';
  if (!base.vehiculo) base.vehiculo = 'Por asignar';

  const costoTotal = costoTotalOperativo(base);
  const utilidad = utilidadOperativa(base);
  return {
    ...base,
    costoTotal,
    utilidad,
    tipo: base.tipoServicio,
  };
};

/**
 * Lee siempre desde disco (sin caché en memoria entre requests): fuente única = archivo.
 */
const readStoreFromDisk = async () => {
  try {
    const raw = await readFile(dataFile, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      console.warn(`${LOG_PREFIX} archivo vacío, se usa lista vacía`);
      return [];
    }
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      console.warn(`${LOG_PREFIX} JSON no es array, se usa lista vacía`);
      return [];
    }
    return parsed;
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return [];
    }
    console.warn(`${LOG_PREFIX} lectura/parse falló (${e?.message || e}), se usa lista vacía`);
    return [];
  }
};

const writeStoreAtomic = async (items) => {
  await mkdir(path.dirname(dataFile), { recursive: true });
  const dir = path.dirname(dataFile);
  const tmp = path.join(dir, `.flota_solicitudes.${process.pid}.${Date.now()}.tmp`);
  const payload = `${JSON.stringify(items, null, 2)}\n`;
  await writeFile(tmp, payload, 'utf8');
  try {
    await rename(tmp, dataFile);
  } catch (e) {
    if (process.platform === 'win32') {
      try {
        await unlink(dataFile);
      } catch {
        /* puede no existir */
      }
      await rename(tmp, dataFile);
    } else {
      try {
        await unlink(tmp);
      } catch {
        /* ignore */
      }
      throw e;
    }
  }
};

const sortByRecency = (items) =>
  [...items].sort((a, b) => {
    const ts = (s) => String(s?.createdAt || s?.updatedAt || '').trim();
    const ca = ts(a).localeCompare(ts(b));
    if (ca !== 0 && (ts(a) || ts(b))) return -ca;
    return String(b.fecha || '').localeCompare(String(a.fecha || ''));
  });

export const solicitudFlotaRepository = {
  async findAll(filters = {}) {
    return withStoreLock(async () => {
      let items = (await readStoreFromDisk()).map(normalizeSolicitudShape);
      if (filters.cliente) {
        const q = String(filters.cliente).trim().toLowerCase();
        items = items.filter((s) => String(s.cliente || '').toLowerCase().includes(q));
      }
      if (filters.estado) {
        items = items.filter((s) => s.estado === filters.estado);
      }
      const sorted = sortByRecency(items);
      console.info(`${LOG_PREFIX} list count=${sorted.length} filters=${JSON.stringify(filters)}`);
      return sorted;
    });
  },

  async findById(id) {
    return withStoreLock(async () => {
      const items = await readStoreFromDisk();
      const found = items.find((s) => s.id === id);
      return found ? normalizeSolicitudShape(found) : null;
    });
  },

  async create(payload, actor = 'sistema') {
    return withStoreLock(async () => {
      const items = await readStoreFromDisk();
      const now = new Date().toISOString();
      const id = nextId(items);
      const raw = {
        id,
        ...payload,
        creadoPor: payload.creadoPor || actor,
        actualizadoPor: actor,
        historial: appendHistorial({}, 'alta', `Solicitud creada · ${payload.estado || 'recibida'}`, actor),
        createdAt: now,
        updatedAt: now,
      };
      console.info(
        `${LOG_PREFIX} create id=${id} actor=${actor} cliente=${String(payload.cliente || '').slice(0, 40)} totalAntes=${items.length}`
      );
      const item = normalizeSolicitudShape(raw);
      const next = [...items, item];
      await writeStoreAtomic(next);
      console.info(`${LOG_PREFIX} persist OK id=${id} totalDespués=${next.length}`);
      return item;
    });
  },

  async update(id, patch, historialEntry = null, actor = 'sistema') {
    return withStoreLock(async () => {
      const items = await readStoreFromDisk();
      const index = items.findIndex((s) => s.id === id);
      if (index === -1) return null;
      const cur = normalizeSolicitudShape(items[index]);
      let updated = { ...cur, ...patch };
      updated.actualizadoPor = actor;
      if (historialEntry) {
        updated.historial = appendHistorial(cur, historialEntry.accion, historialEntry.detalle, actor);
      }
      updated.updatedAt = new Date().toISOString();
      updated = normalizeSolicitudShape(updated);
      const next = [...items];
      next[index] = updated;
      console.info(`${LOG_PREFIX} update id=${id} actor=${actor} total=${next.length}`);
      await writeStoreAtomic(next);
      console.info(`${LOG_PREFIX} persist OK patch id=${id}`);
      return updated;
    });
  },
};
