export const planMantencionModel = {
  name: 'planMantencion',
  fields: ['id', 'tiendaId', 'fecha', 'tecnico', 'horaInicio', 'horaFin', 'tipo', 'estado'],
  tipos: ['preventivo', 'correctivo'],
  estados: ['pendiente', 'programado', 'realizado'],
};
