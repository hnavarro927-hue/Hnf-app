import { createJsonStore, makeCrudRepository } from './hnfJsonStore.repository.js';

const store = createJsonStore('hnf_maestro_contactos.json');

const nextId = (items) => {
  const n = items.reduce((max, item) => {
    const m = typeof item.id === 'string' ? item.id.match(/^MCO-(\d+)$/i) : null;
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `MCO-${String(n + 1).padStart(4, '0')}`;
};

const base = makeCrudRepository(store, nextId);

export const maestroContactoRepository = {
  findAll: () => base.findAll(),
  findById: (id) => base.findById(id),
  create: (row, actor) => base.create(row, actor, 'alta_contacto', 'Contacto maestro'),
  update: (id, patch, actor) => base.update(id, patch, { accion: 'edicion_contacto', detalle: 'Actualización' }, actor),
};
