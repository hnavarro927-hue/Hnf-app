import { createJsonStore, makeCrudRepository } from './hnfJsonStore.repository.js';

const store = createJsonStore('hnf_validation_queue.json');

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^VAL-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `VAL-${String(n + 1).padStart(4, '0')}`;
};

const base = makeCrudRepository(store, nextId);

export const hnfValidationQueueRepository = {
  findAll: () => base.findAll(),
  findById: (id) => base.findById(id),
  create: (row, actor, detalle) => base.create(row, actor, 'ingreso', detalle),
  update: (id, patch, hist, actor) => base.update(id, patch, hist, actor),
};
