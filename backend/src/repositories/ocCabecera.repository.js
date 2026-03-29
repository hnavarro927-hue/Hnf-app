import { createJsonStore, makeCrudRepository } from './hnfJsonStore.repository.js';

const store = createJsonStore('hnf_oc_cabeceras.json');

const nextId = (items) => {
  const n = items.reduce((max, x) => {
    const m = String(x.id || '').match(/^OC-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `OC-${String(n + 1).padStart(4, '0')}`;
};

const base = makeCrudRepository(store, nextId);

export const ocCabeceraRepository = {
  findAll: () => base.findAll(),
  findById: (id) => base.findById(id),
  create: (row, actor) => base.create(row, actor, 'alta_oc', `OC ${row.numeroOc || 'sin número'}`),
  update: (id, patch, actor, detalle) =>
    base.update(id, patch, detalle ? { accion: 'oc_cabecera', detalle: String(detalle).slice(0, 500) } : null, actor),
};
