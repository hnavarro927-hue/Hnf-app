import { createJsonStore, makeCrudRepository } from './hnfJsonStore.repository.js';

const store = createJsonStore('hnf_commercial_leads.json');

const nextId = (items) => {
  const n = items.reduce((max, x) => {
    const m = String(x.id || '').match(/^LED-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `LED-${String(n + 1).padStart(4, '0')}`;
};

const base = makeCrudRepository(store, nextId);

export const commercialLeadRepository = {
  async findAll() {
    return base.findAll();
  },
  async findById(id) {
    return base.findById(id);
  },
  async findByMaestroDocumentoId(docId) {
    const mid = String(docId || '').trim();
    if (!mid) return null;
    const list = await store.readAll();
    return list.find((x) => String(x.maestroDocumentoOrigenId || '').trim() === mid) || null;
  },
  async create(row, actor) {
    return base.create(row, actor, 'alta_crm_lead', `Lead ${row.nombreContacto || row.empresa || 'CRM'}`);
  },
  async update(id, patch, actor, detalle = 'Actualización lead') {
    return base.update(id, patch, { accion: 'crm_lead', detalle: String(detalle).slice(0, 500) }, actor);
  },
};
