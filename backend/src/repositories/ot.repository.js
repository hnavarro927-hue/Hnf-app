const otCollection = [
  {
    id: 'OT-001',
    cliente: { nombre: 'Cliente Demo', direccion: 'Av. Principal 123', contacto: 'Encargado Demo' },
    vehiculo: { patente: 'KJTR21', marca: 'Ford', modelo: 'Transit', anio: 2022, kilometraje: 80340 },
    servicio: {
      tipoServicio: 'RT',
      descripcion: 'Atención en ruta por falla menor',
      fecha: '2026-04-22',
      horaInicio: '10:30',
      horaTermino: '12:00',
      duracion: '01:30',
      tecnico: 'Gery',
    },
    costos: {
      items: [{ descripcion: 'Mano de obra RT', cantidad: 1, precioUnitario: 55000, total: 55000 }],
      totalManoObra: 55000,
      totalInsumos: 0,
      totalNeto: 55000,
    },
    evidencia: {
      fotos: { frontal: [], trasera: [], laterales: [], kilometraje: [], documentos: [] },
    },
    control: { estado: 'abierta' },
    creadoDesde: { tipo: 'gestion', referenciaId: 'GES-001' },
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

    ot.control.estado = estado;
    return ot;
  },
};
