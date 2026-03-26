import { createJsonStore, makeCrudRepository } from './hnfJsonStore.repository.js';

const store = createJsonStore('hnf_extended_clients.json');

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^XCL-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `XCL-${String(n + 1).padStart(4, '0')}`;
};

const base = makeCrudRepository(store, nextId);

export const hnfExtendedClientRepository = {
  findAll: () => base.findAll(),
  findById: (id) => base.findById(id),
  create: (row, actor, detalle) => base.create(row, actor, 'alta_cliente', detalle),
  update: (id, patch, hist, actor) => base.update(id, patch, hist, actor),
};
