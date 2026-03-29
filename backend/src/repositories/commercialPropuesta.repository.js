import { createJsonStore, makeCrudRepository } from './hnfJsonStore.repository.js';

const store = createJsonStore('hnf_commercial_propuestas.json');

const nextId = (items) => {
  const n = items.reduce((max, x) => {
    const m = String(x.id || '').match(/^PRP-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `PRP-${String(n + 1).padStart(4, '0')}`;
};

const base = makeCrudRepository(store, nextId);

export const commercialPropuestaRepository = {
  findAll: () => base.findAll(),
  findById: (id) => base.findById(id),
  create: (row, actor) => base.create(row, actor, 'alta_comercial', row.titulo || 'Propuesta / borrador'),
  update: (id, patch, actor, detalle) =>
    base.update(
      id,
      patch,
      detalle ? { accion: 'commercial_workspace', detalle: String(detalle).slice(0, 500) } : null,
      actor
    ),
};
