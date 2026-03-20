const expenseCollection = [
  {
    id: 'EXP-001',
    fecha: '2026-03-20',
    categoria: 'combustible',
    monto: 25000,
    descripcion: 'Carga inicial',
    centroCosto: 'operaciones',
    clienteRelacionado: null,
    otRelacionada: 'OT-001',
    comprobante: null,
  },
];

const createId = () => `EXP-${String(expenseCollection.length + 1).padStart(3, '0')}`;

export const expenseRepository = {
  mode: 'memory-fallback',
  findAll() {
    return expenseCollection;
  },
  findById(id) {
    return expenseCollection.find((item) => item.id === id) || null;
  },
  create(data) {
    const item = { id: createId(), ...data };
    expenseCollection.push(item);
    return item;
  },
};
