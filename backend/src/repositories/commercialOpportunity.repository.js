import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { commercialOpportunityModel } from '../models/commercialOpportunity.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.resolve(__dirname, '../../data/commercial_opportunities.json');

let cache = null;

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^OPP-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `OPP-${String(n + 1).padStart(4, '0')}`;
};

const asArr = (x) => (Array.isArray(x) ? x : []);

const normalize = (row) => ({
  id: String(row.id || '').trim(),
  technicalDocumentId: String(row.technicalDocumentId || '').trim(),
  cliente: String(row.cliente ?? '').trim(),
  tipoServicio: String(row.tipoServicio || '').trim(),
  descripcion: String(row.descripcion ?? '').trim(),
  prioridad: String(row.prioridad || 'media').trim(),
  estimacionMonto: Number.isFinite(Number(row.estimacionMonto)) ? Number(row.estimacionMonto) : 0,
  estimacionEtiqueta: String(row.estimacionEtiqueta ?? '').trim(),
  estado: String(row.estado || 'pendiente').trim(),
  fechaCreacion: String(row.fechaCreacion || ''),
  origen: String(row.origen || 'manual').trim(),
  regla: String(row.regla ?? '').trim(),
  updatedAt: String(row.updatedAt || ''),
  updatedBy: String(row.updatedBy || ''),
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

export const commercialOpportunityRepository = {
  async findAll() {
    return (await loadStore()).map(normalize);
  },

  async findById(id) {
    const items = await loadStore();
    const x = items.find((e) => e.id === id);
    return x ? normalize(x) : null;
  },

  async deleteAutomaticByTechnicalDocumentId(technicalDocumentId) {
    const tid = String(technicalDocumentId || '').trim();
    if (!tid) return 0;
    const items = await loadStore();
    const next = items.filter(
      (e) => !(e.technicalDocumentId === tid && String(e.origen || '').toLowerCase() === 'automatico')
    );
    const removed = items.length - next.length;
    if (removed) await saveStore(next);
    return removed;
  },

  async insertMany(rows, actor) {
    const items = await loadStore();
    const now = new Date().toISOString();
    const created = [];
    const base = [...items];
    for (const r of rows) {
      const id = nextId(base);
      let row = normalize({
        ...r,
        id,
        updatedAt: now,
        updatedBy: String(actor || r.updatedBy || 'sistema').slice(0, 80),
      });
      if (!commercialOpportunityModel.tiposServicio.includes(row.tipoServicio)) continue;
      if (!commercialOpportunityModel.prioridades.includes(row.prioridad)) row = { ...row, prioridad: 'media' };
      if (!commercialOpportunityModel.estados.includes(row.estado)) row = { ...row, estado: 'pendiente' };
      base.push(row);
      created.push(row);
    }
    if (created.length) await saveStore(base);
    return created;
  },

  async updateEstado(id, estado, actor) {
    const items = await loadStore();
    const i = items.findIndex((e) => e.id === id);
    if (i < 0) return null;
    if (!commercialOpportunityModel.estados.includes(estado)) return null;
    const now = new Date().toISOString();
    const cur = normalize(items[i]);
    const next = normalize({
      ...cur,
      estado,
      updatedAt: now,
      updatedBy: String(actor || 'sistema').slice(0, 80),
    });
    items[i] = next;
    await saveStore(items);
    return next;
  },
};
