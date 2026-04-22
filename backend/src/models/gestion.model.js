export const gestionModel = {
  name: 'gestiones',
  fields: ['id', 'fecha', 'cliente', 'patente', 'servicio', 'tipo', 'tecnico', 'estado', 'observaciones', 'origenMensajeId'],
  typeOptions: ['RT', 'traslado', 'mantencion'],
  statusOptions: ['pendiente', 'en proceso', 'terminado'],
};
