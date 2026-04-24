const approvalCollection = [];

const createId = () => `APR-${String(approvalCollection.length + 1).padStart(3, '0')}`;

export const approvalRepository = {
  mode: 'memory-fallback',
  findAll() {
    return approvalCollection;
  },
  create(data) {
    const item = { id: createId(), fecha: new Date().toISOString(), estado: 'pendiente', ...data };
    approvalCollection.push(item);
    return item;
  },
  decide(id, payload) {
    const item = approvalCollection.find((entry) => entry.id === id);
    if (!item) return null;
    Object.assign(item, payload);
    return item;
  },
  findPendingByRef(refTipo, refId) {
    return approvalCollection.find((item) => item.referenciaTipo === refTipo && item.referenciaId === refId && item.estado === 'pendiente') || null;
  },
};
