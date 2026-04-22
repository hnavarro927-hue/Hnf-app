export const messageModel = {
  name: 'messages',
  fields: ['id', 'fuente', 'remitente', 'nombre', 'mensaje', 'fechaHora', 'estado', 'clasificacion', 'reviewedBy'],
  sourceOptions: ['whatsapp', 'email'],
  statusOptions: ['nuevo', 'reviewed_by_gery', 'approved_by_lyn', 'converted_to_gestion', 'converted_to_OT', 'en_proceso', 'terminado', 'cerrado'],
};
