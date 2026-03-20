export const otModel = {
  name: 'ot',
  fields: [
    'id',
    'cliente',
    'clienteRelacionado',
    'vehiculoRelacionado',
    'tipoServicio',
    'tecnicoAsignado',
    'estado',
    'fecha',
    'observaciones',
    'fotografias',
  ],
  statusOptions: ['pendiente', 'en proceso', 'terminado'],
  serviceTypes: ['clima', 'flota'],
};
