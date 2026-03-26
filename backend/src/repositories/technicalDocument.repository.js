import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/technical_documents.json');

let cache = null;

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^DOC-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `DOC-${String(n + 1).padStart(4, '0')}`;
};

const nextComId = (comments) => {
  const n = (Array.isArray(comments) ? comments : []).reduce((max, c) => {
    const m = String(c?.id || '').match(/^COM-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `COM-${String(n + 1).padStart(4, '0')}`;
};

const nextEvId = (evs) => {
  const n = (Array.isArray(evs) ? evs : []).reduce((max, e) => {
    const m = String(e?.id || '').match(/^DEV-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `DEV-${String(n + 1).padStart(4, '0')}`;
};

const nextAudId = (hist) => {
  const n = (Array.isArray(hist) ? hist : []).reduce((max, h) => {
    const m = String(h?.id || '').match(/^AUD-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `AUD-${String(n + 1).padStart(4, '0')}`;
};

const asArr = (x) => (Array.isArray(x) ? x : []);

const normalize = (d) => ({
  id: String(d.id || '').trim(),
  otId: d.otId != null ? String(d.otId).trim() : '',
  cliente: String(d.cliente ?? '').trim(),
  tiendaNombre: String(d.tiendaNombre ?? '').trim(),
  sucursal: String(d.sucursal ?? '').trim(),
  fechaServicio: String(d.fechaServicio ?? '').slice(0, 10),
  horaIngreso: String(d.horaIngreso ?? '').trim(),
  horaSalida: String(d.horaSalida ?? '').trim(),
  tecnicos: asArr(d.tecnicos).map((t) => String(t).trim()).filter(Boolean),
  tipoMantencion: String(d.tipoMantencion ?? '').trim(),
  estadoDocumento: String(d.estadoDocumento || d.estado || 'borrador').trim(),
  estado: String(d.estado || d.estadoDocumento || 'borrador').trim(),
  fuente: String(d.fuente || 'manual').trim(),
  numeroDocumento: String(d.numeroDocumento ?? '').trim(),
  tituloDocumento: String(d.tituloDocumento ?? '').trim(),
  resumenEjecutivo: String(d.resumenEjecutivo ?? '').trim(),
  inspeccionInicial: String(d.inspeccionInicial ?? '').trim(),
  trabajosRealizados: String(d.trabajosRealizados ?? '').trim(),
  materialesHerramientas: String(d.materialesHerramientas ?? '').trim(),
  epp: String(d.epp ?? '').trim(),
  observacionesTecnicas: String(d.observacionesTecnicas ?? '').trim(),
  recomendaciones: String(d.recomendaciones ?? '').trim(),
  recepcionTrabajo: String(d.recepcionTrabajo ?? '').trim(),
  limitacionesServicio: String(d.limitacionesServicio ?? '').trim(),
  garantiaObservada: String(d.garantiaObservada ?? '').trim(),
  hallazgosCriticos: asArr(d.hallazgosCriticos),
  mediciones: asArr(d.mediciones),
  evidencias: asArr(d.evidencias),
  comentariosInternos: asArr(d.comentariosInternos),
  versiones: asArr(d.versiones),
  activosRelacionados: asArr(d.activosRelacionados).map((x) => String(x).trim()).filter(Boolean),
  eventosIngesta: asArr(d.eventosIngesta),
  enviadoRevisionPor: d.enviadoRevisionPor != null ? String(d.enviadoRevisionPor).trim() : null,
  enviadoRevisionEn: d.enviadoRevisionEn != null ? String(d.enviadoRevisionEn) : null,
  observadoPor: d.observadoPor != null ? String(d.observadoPor).trim() : null,
  observadoEn: d.observadoEn != null ? String(d.observadoEn) : null,
  aprobadoPor: d.aprobadoPor != null ? String(d.aprobadoPor).trim() : null,
  aprobadoEn: d.aprobadoEn != null ? String(d.aprobadoEn) : null,
  enviadoClientePor: d.enviadoClientePor != null ? String(d.enviadoClientePor).trim() : null,
  enviadoClienteEn: d.enviadoClienteEn != null ? String(d.enviadoClienteEn) : null,
  createdAt: String(d.createdAt || ''),
  updatedAt: String(d.updatedAt || ''),
  createdBy: String(d.createdBy || ''),
  updatedBy: String(d.updatedBy || ''),
  creadoPor: String(d.creadoPor || d.createdBy || '').trim(),
  revisadoPor: d.revisadoPor != null ? String(d.revisadoPor).trim() : null,
  fechaRevision: d.fechaRevision != null ? String(d.fechaRevision) : null,
  fechaAprobacion:
    d.fechaAprobacion != null ? String(d.fechaAprobacion) : d.aprobadoEn != null ? String(d.aprobadoEn) : null,
  fechaEnvio:
    d.fechaEnvio != null ? String(d.fechaEnvio) : d.enviadoClienteEn != null ? String(d.enviadoClienteEn) : null,
  comentariosRevision: asArr(d.comentariosRevision),
  historialDocumental: asArr(d.historialDocumental),
  documentSnapshots: asArr(d.documentSnapshots),
  version: Number.isFinite(Number(d.version)) && Number(d.version) >= 1 ? Math.floor(Number(d.version)) : 1,
  clienteInformePremium: d.clienteInformePremium && typeof d.clienteInformePremium === 'object' ? d.clienteInformePremium : null,
  alertasIngesta: asArr(d.alertasIngesta),
  ingestaResumen: d.ingestaResumen != null && typeof d.ingestaResumen === 'object' ? d.ingestaResumen : null,
  analisisJarvis: d.analisisJarvis != null && typeof d.analisisJarvis === 'object' ? d.analisisJarvis : null,
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

export const technicalDocumentRepository = {
  async findAll() {
    return (await loadStore()).map(normalize);
  },

  async findById(id) {
    const items = await loadStore();
    const x = items.find((e) => e.id === id);
    return x ? normalize(x) : null;
  },

  async create(payload, actor = 'sistema') {
    const items = await loadStore();
    const now = new Date().toISOString();
    const id = nextId(items);
    const est = String(payload.estadoDocumento || 'borrador');
    const histIncoming = asArr(payload.historialDocumental);
    const initialHist =
      histIncoming.length > 0
        ? histIncoming
        : [
            {
              id: nextAudId([]),
              accion: String(payload.fuente || '')
                .toLowerCase()
                .includes('pdf')
                ? 'ingesta'
                : 'crear',
              actor,
              fecha: now,
              comentario: '',
              estadoAntes: null,
              estadoDespues: est,
            },
          ];
    const row = normalize({
      ...payload,
      id,
      hallazgosCriticos: asArr(payload.hallazgosCriticos),
      mediciones: asArr(payload.mediciones),
      evidencias: asArr(payload.evidencias),
      comentariosInternos: [],
      comentariosRevision: asArr(payload.comentariosRevision),
      historialDocumental: initialHist,
      documentSnapshots: asArr(payload.documentSnapshots),
      version: Number.isFinite(Number(payload.version)) ? Math.floor(Number(payload.version)) : 1,
      estado: est,
      creadoPor: String(payload.creadoPor || actor).slice(0, 80),
      versiones: [
        {
          at: now,
          actor,
          estadoDocumento: est,
          nota: 'Alta',
        },
      ],
      eventosIngesta: asArr(payload.eventosIngesta),
      activosRelacionados: asArr(payload.activosRelacionados),
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    });
    items.push(row);
    await saveStore(items);
    return normalize(row);
  },

  async update(id, patch, actor = 'sistema') {
    const items = await loadStore();
    const i = items.findIndex((e) => e.id === id);
    if (i < 0) return null;
    const cur = normalize(items[i]);
    const now = new Date().toISOString();
    const next = normalize({ ...cur, ...patch, id: cur.id });
    if (next.estadoDocumento) next.estado = next.estadoDocumento;
    next.updatedAt = now;
    next.updatedBy = actor;
    if (patch.estadoDocumento && patch.estadoDocumento !== cur.estadoDocumento) {
      next.versiones = [
        ...asArr(cur.versiones),
        {
          at: now,
          actor,
          estadoDocumento: patch.estadoDocumento,
          nota: String(patch.versionNota || '').trim() || 'Cambio de estado',
        },
      ];
    }
    items[i] = next;
    await saveStore(items);
    return normalize(next);
  },

  async appendComment(id, comment, actor) {
    const items = await loadStore();
    const i = items.findIndex((e) => e.id === id);
    if (i < 0) return null;
    const cur = normalize(items[i]);
    const now = new Date().toISOString();
    const cid = nextComId(cur.comentariosInternos);
    const row = {
      id: cid,
      actor: String(comment.actor || actor || 'sistema').slice(0, 80),
      rol: String(comment.rol || 'revision').slice(0, 40),
      fecha: now,
      tipo: String(comment.tipo || 'redaccion'),
      textoOriginal: String(comment.textoOriginal ?? '').trim(),
      sugerencia: String(comment.sugerencia ?? '').trim(),
      motivo: String(comment.motivo ?? '').trim(),
    };
    const next = normalize({
      ...cur,
      comentariosInternos: [...asArr(cur.comentariosInternos), row],
      updatedAt: now,
      updatedBy: actor,
    });
    items[i] = next;
    await saveStore(items);
    return normalize(next);
  },

  async appendIngestaEvent(id, ev, actor) {
    const items = await loadStore();
    const i = items.findIndex((e) => e.id === id);
    if (i < 0) return null;
    const cur = normalize(items[i]);
    const now = new Date().toISOString();
    const eid = nextEvId(cur.eventosIngesta);
    const row = {
      id: eid,
      at: now,
      tipo: String(ev.tipo || 'observacion'),
      actor: String(ev.actor || actor || 'sistema').slice(0, 80),
      texto: String(ev.texto ?? '').trim(),
      fuente: String(ev.fuente || 'whatsapp').trim(),
    };
    const next = normalize({
      ...cur,
      eventosIngesta: [...asArr(cur.eventosIngesta), row],
      updatedAt: now,
      updatedBy: actor,
    });
    items[i] = next;
    await saveStore(items);
    return normalize(next);
  },
};
