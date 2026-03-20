// Base preparada para el siguiente paso funcional.
// Todavía no existen formularios operativos en frontend; aquí solo se define la estructura esperada.
export const otFormDefinition = {
  endpoint: '/ots',
  submitLabel: 'Crear OT',
  fields: [
    { name: 'cliente', label: 'Cliente', type: 'text', required: true },
    { name: 'clienteRelacionado', label: 'Cliente relacionado', type: 'text', required: false },
    { name: 'vehiculoRelacionado', label: 'Vehículo relacionado', type: 'text', required: false },
    { name: 'tipoServicio', label: 'Tipo de servicio', type: 'select', required: true, options: ['clima', 'flota'] },
    { name: 'tecnicoAsignado', label: 'Técnico asignado', type: 'text', required: false },
    { name: 'fecha', label: 'Fecha', type: 'date', required: true },
    { name: 'observaciones', label: 'Observaciones', type: 'textarea', required: false },
    { name: 'fotografias', label: 'Evidencias', type: 'file-list', required: false },
  ],
};

export const expenseFormDefinition = {
  endpoint: '/expenses',
  submitLabel: 'Registrar gasto',
  fields: [
    { name: 'fecha', label: 'Fecha', type: 'date', required: true },
    { name: 'categoria', label: 'Categoría', type: 'text', required: true },
    { name: 'monto', label: 'Monto', type: 'number', required: true },
    { name: 'descripcion', label: 'Descripción', type: 'textarea', required: true },
    { name: 'centroCosto', label: 'Centro de costo', type: 'text', required: true },
    { name: 'clienteRelacionado', label: 'Cliente relacionado', type: 'text', required: false },
    { name: 'otRelacionada', label: 'OT relacionada', type: 'text', required: false },
    { name: 'comprobante', label: 'Comprobante', type: 'file-list', required: false },
  ],
};
