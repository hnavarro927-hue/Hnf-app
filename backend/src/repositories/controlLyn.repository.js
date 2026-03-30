import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/hnf_control_lyn_registro.json');

const defaultDoc = () => ({
  id: 'lyn-registro',
  montoEntregado: null,
  solicitudTelefonica: '',
  compra: '',
  combustible: '',
  refrigerante: '',
  equipo: '',
  uniforme: '',
  epp: '',
  inventarioCritico: '',
  observaciones: '',
  respaldo: '',
  actualizadoAt: null,
  actualizadoPor: null,
});

const KEYS = [
  'montoEntregado',
  'solicitudTelefonica',
  'compra',
  'combustible',
  'refrigerante',
  'equipo',
  'uniforme',
  'epp',
  'inventarioCritico',
  'observaciones',
  'respaldo',
];

function normalize(raw) {
  const d = defaultDoc();
  if (!raw || typeof raw !== 'object') return d;
  const out = { ...d };
  for (const k of KEYS) {
    if (k === 'montoEntregado') {
      const v = raw[k];
      if (v === null || v === undefined || v === '') {
        out[k] = null;
      } else {
        const n = Number(v);
        out[k] = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
      }
      continue;
    }
    out[k] = String(raw[k] ?? '').slice(0, 6000);
  }
  out.actualizadoAt = raw.actualizadoAt != null ? String(raw.actualizadoAt).slice(0, 40) : null;
  out.actualizadoPor = raw.actualizadoPor != null ? String(raw.actualizadoPor).slice(0, 120) : null;
  return out;
}

/** @type {ReturnType<typeof defaultDoc> | null} */
let cache = null;
/** @type {number | null} */
let cacheMtimeMs = null;

async function loadFromDisk() {
  await mkdir(path.dirname(dataFile), { recursive: true });
  let mtimeMs = null;
  try {
    const st = await stat(dataFile);
    mtimeMs = st.mtimeMs;
    if (cache != null && cacheMtimeMs === mtimeMs) {
      return cache;
    }
  } catch {
    mtimeMs = null;
  }

  try {
    const raw = await readFile(dataFile, 'utf8');
    const j = JSON.parse(raw);
    cache = normalize(j);
  } catch {
    cache = defaultDoc();
  }

  try {
    const st2 = await stat(dataFile);
    cacheMtimeMs = st2.mtimeMs;
  } catch {
    cacheMtimeMs = mtimeMs ?? Date.now();
  }
  return cache;
}

async function persist(doc) {
  const body = normalize(doc);
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  cache = body;
  try {
    const st = await stat(dataFile);
    cacheMtimeMs = st.mtimeMs;
  } catch {
    cacheMtimeMs = Date.now();
  }
  return body;
}

export const controlLynRepository = {
  async get() {
    const row = await loadFromDisk();
    return { ...row };
  },

  async save(doc) {
    return persist(doc);
  },
};
