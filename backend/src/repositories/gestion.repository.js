const gestionCollection = [
  {
    id: 'GES-001',
    fecha: '2026-04-22',
    cliente: 'Cliente Demo Flota',
    patente: 'KJTR21',
    servicio: 'Revisión técnica en ruta',
    tipo: 'RT',
    tecnico: 'Gery',
    estado: 'en proceso',
    observaciones: 'Unidad en patio esperando repuesto menor.',
    origenMensajeId: 'MSG-001',
  },
];

const createId = () => `GES-${String(gestionCollection.length + 1).padStart(3, '0')}`;

export const gestionRepository = {
  mode: 'memory-fallback',
  findAll() {
    return gestionCollection;
  },
  create(data) {
    const item = { id: createId(), ...data };
    gestionCollection.push(item);
    return item;
  },
  findById(id) {
    return gestionCollection.find((entry) => entry.id === id) || null;
  },
  updateStatus(id, estado) {
    const item = gestionCollection.find((entry) => entry.id === id);
    if (!item) return null;
    item.estado = estado;
    return item;
  },
};
