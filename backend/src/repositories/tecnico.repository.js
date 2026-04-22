const tecnicoCollection = [
  { id: 'TEC-001', nombre: 'Gery', rol: 'inbox_operator', unidad: 'central', activo: true },
  { id: 'TEC-002', nombre: 'Lyn', rol: 'mandatory_approver', unidad: 'gerencia', activo: true },
  { id: 'TEC-003', nombre: 'Hernan', rol: 'manager_full_control', unidad: 'gerencia', activo: true },
];

const createId = () => `TEC-${String(tecnicoCollection.length + 1).padStart(3, '0')}`;

export const tecnicoRepository = {
  mode: 'memory-fallback',
  findAll() {
    return tecnicoCollection;
  },
  create(data) {
    const item = { id: createId(), ...data };
    tecnicoCollection.push(item);
    return item;
  },
  findByName(nombre) {
    return tecnicoCollection.find((item) => item.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  },
};
