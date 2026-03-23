import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solicitudFlotaModel } from '../models/solicitudFlota.model.js';
import { appendHistorial } from '../utils/historialUtil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/flota_solicitudes.json');

let cache = null;

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

const computeCostoTotal = (s) =>
  round2(
    round2(s.costoCombustible) +
      round2(s.costoPeaje) +
      round2(s.costoChofer) +
      round2(s.costoExterno) +
      round2(s.materiales) +
      round2(s.manoObra) +
      round2(s.costoTraslado) +
      round2(s.otros)
  );

const computeUtilidad = (s) => {
  const ing =
    round2(s.ingresoFinal) ||
    round2(s.montoCobrado) ||
    round2(s.monto) ||
    round2(s.ingresoEstimado);
  const ct = computeCostoTotal(s);
  return round2(ing - ct);
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
    createdAt,
    updatedAt: s.updatedAt || now,
  };

  if (!base.hora && base.fecha) base.hora = '09:00';
  if (!base.origen) base.origen = '—';
  if (!base.destino) base.destino = '—';
  if (!base.conductor) base.conductor = 'Por asignar';
  if (!base.vehiculo) base.vehiculo = 'Por asignar';

  const costoTotal = computeCostoTotal(base);
  const utilidad = computeUtilidad({ ...base, costoTotal });
  return {
    ...base,
    costoTotal,
    utilidad,
    tipo: base.tipoServicio,
  };
};

const loadStore = async () => {
  if (cache) return cache;
  try {
    const raw = await readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.map(normalizeSolicitudShape) : [];
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

export const solicitudFlotaRepository = {
  async findAll(filters = {}) {
    let items = await loadStore();
    if (filters.cliente) {
      const q = String(filters.cliente).trim().toLowerCase();
      items = items.filter((s) => String(s.cliente || '').toLowerCase().includes(q));
    }
    if (filters.estado) {
      items = items.filter((s) => s.estado === filters.estado);
    }
    return items.map(normalizeSolicitudShape).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  },

  async findById(id) {
    const items = await loadStore();
    const found = items.find((s) => s.id === id);
    return found ? normalizeSolicitudShape(found) : null;
  },

  async create(payload) {
    const items = await loadStore();
    const now = new Date().toISOString();
    const raw = {
      id: nextId(items),
      ...payload,
      historial: appendHistorial({}, 'alta', `Solicitud creada · ${payload.estado || 'recibida'}`),
      createdAt: now,
      updatedAt: now,
    };
    const item = normalizeSolicitudShape(raw);
    const next = [...items, item];
    await saveStore(next);
    return item;
  },

  async update(id, patch, historialEntry = null) {
    const items = await loadStore();
    const index = items.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const cur = normalizeSolicitudShape(items[index]);
    let updated = { ...cur, ...patch };
    if (historialEntry) {
      updated.historial = appendHistorial(cur, historialEntry.accion, historialEntry.detalle);
    }
    updated.updatedAt = new Date().toISOString();
    updated = normalizeSolicitudShape(updated);
    const next = [...items];
    next[index] = updated;
    await saveStore(next);
    return updated;
  },
};
