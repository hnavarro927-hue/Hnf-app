// Base preparada para el siguiente paso funcional.
// La OT ahora cuenta con estructura operativa para luego generar informe/PDF con fotos incrustadas.
export const otFormDefinition = {
  endpoint: '/ots',
  submitLabel: 'Crear OT',
  sections: [
    {
      title: 'Datos principales',
      fields: [
        { name: 'cliente', label: 'Cliente', type: 'text', required: true },
        { name: 'direccion', label: 'Dirección', type: 'text', required: true },
        { name: 'comuna', label: 'Comuna', type: 'text', required: true },
        { name: 'contactoTerreno', label: 'Contacto en terreno', type: 'text', required: true },
        { name: 'telefonoContacto', label: 'Teléfono de contacto', type: 'tel', required: true },
        { name: 'tipoServicio', label: 'Tipo de servicio', type: 'select', required: true, options: ['clima', 'flota'] },
        { name: 'subtipoServicio', label: 'Subtipo de servicio', type: 'text', required: true },
        { name: 'tecnicoAsignado', label: 'Técnico asignado', type: 'text', required: false },
        { name: 'fecha', label: 'Fecha', type: 'date', required: true },
        { name: 'hora', label: 'Hora', type: 'time', required: true },
        { name: 'estado', label: 'Estado inicial', type: 'readonly', required: true, defaultValue: 'pendiente' },
      ],
    },
    {
      title: 'Detalle técnico',
      fields: [
        { name: 'observaciones', label: 'Observaciones', type: 'textarea', required: false },
        { name: 'resumenTrabajo', label: 'Resumen del trabajo', type: 'textarea', required: false },
        { name: 'recomendaciones', label: 'Recomendaciones', type: 'textarea', required: false },
      ],
    },
    {
      title: 'Evidencias fotográficas',
      fields: [
        { name: 'fotografiasAntes', label: 'Fotografías antes', type: 'file-list', required: false },
        { name: 'fotografiasDurante', label: 'Fotografías durante', type: 'file-list', required: false },
        { name: 'fotografiasDespues', label: 'Fotografías después', type: 'file-list', required: false },
      ],
    },
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
