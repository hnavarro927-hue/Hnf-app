const otCollection = [
  {
    id: 'OT-001',
    cliente: 'Cliente Demo',
    clienteRelacionado: 'CLI-001',
    vehiculoRelacionado: null,
    tipoServicio: 'clima',
    tecnicoAsignado: 'Técnico Demo',
    estado: 'pendiente',
    fecha: '2026-03-20',
    observaciones: 'Visita de diagnóstico inicial.',
    fotografias: [{ id: 'photo-1', name: 'foto-inicial-01.jpg', url: '' }],
  },
];

const createId = () => `OT-${String(otCollection.length + 1).padStart(3, '0')}`;

export const otRepository = {
  mode: 'memory-fallback',
  findAll() {
    return otCollection;
  },
  create(data) {
    const item = { id: createId(), ...data };
    otCollection.push(item);
    return item;
  },
  updateStatus(id, estado) {
    const ot = otCollection.find((item) => item.id === id);
    if (!ot) {
      return null;
    }

    ot.estado = estado;
    return ot;
  },
};
