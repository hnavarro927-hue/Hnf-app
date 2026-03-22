export const planMantencionModel = {
  name: 'planMantencion',
  fields: ['id', 'tiendaId', 'fecha', 'tecnico', 'tipo', 'estado'],
  tipos: ['preventivo', 'correctivo'],
  estados: ['pendiente', 'programado', 'realizado'],
};
