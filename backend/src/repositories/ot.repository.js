const otCollection = [
  {
    id: 'OT-001',
    cliente: 'Cliente Demo',
    direccion: 'Av. Principal 123',
    comuna: 'Santiago',
    contactoTerreno: 'Encargado Demo',
    telefonoContacto: '+56 9 1111 2222',
    clienteRelacionado: 'CLI-001',
    vehiculoRelacionado: null,
    tipoServicio: 'clima',
    subtipoServicio: 'Mantenimiento preventivo',
    tecnicoAsignado: 'Técnico Demo',
    estado: 'pendiente',
    fecha: '2026-03-20',
    hora: '09:00',
    observaciones: 'Visita de diagnóstico inicial.',
    resumenTrabajo: 'Inspección general del sistema.',
    recomendaciones: 'Revisar filtros en próxima visita.',
    fotografiasAntes: [{ id: 'before-1', name: 'antes-01.jpg', url: '' }],
    fotografiasDurante: [{ id: 'during-1', name: 'durante-01.jpg', url: '' }],
    fotografiasDespues: [{ id: 'after-1', name: 'despues-01.jpg', url: '' }]
  }
];

const createId = () =>
  `OT-${String(otCollection.length + 1).padStart(3, '0')}`;

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
    const ot = otCollection.find(item => item.id === id);
    if (!ot) return null;

    ot.estado = estado;
    return ot;
  }
};