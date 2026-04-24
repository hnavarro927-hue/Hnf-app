const messageCollection = [
  {
    id: 'MSG-001',
    fuente: 'whatsapp',
    remitente: '+56 9 7788 9900',
    nombre: 'Sucursal Quilicura',
    mensaje: 'Necesitamos RT en camioneta patente KJTR21 para hoy 14:00.',
    fechaHora: '2026-04-22T10:15:00Z',
    estado: 'nuevo',
    clasificacion: null,
    reviewedBy: null,
  },
];

const createId = () => `MSG-${String(messageCollection.length + 1).padStart(3, '0')}`;

export const messageRepository = {
  mode: 'memory-fallback',
  findAll() {
    return messageCollection;
  },
  create(data) {
    const item = { id: createId(), ...data };
    messageCollection.push(item);
    return item;
  },
  update(id, changes) {
    const item = messageCollection.find((entry) => entry.id === id);
    if (!item) return null;
    Object.assign(item, changes);
    return item;
  },
  findById(id) {
    return messageCollection.find((entry) => entry.id === id) || null;
  },
};
