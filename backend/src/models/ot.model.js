export const otModel = {
  name: 'ot',
  fields: [
    'id',
    'cliente',
    'direccion',
    'comuna',
    'contactoTerreno',
    'telefonoContacto',
    'clienteRelacionado',
    'vehiculoRelacionado',
    'tipoServicio',
    'subtipoServicio',
    'tecnicoAsignado',
    'estado',
    'fecha',
    'hora',
    'observaciones',
    'resumenTrabajo',
    'recomendaciones',
    'creadoEn',
    'cerradoEn',
    'createdAt',
    'updatedAt',
    'creadoPor',
    'actualizadoPor',
    /** manual | automatic — control operativo (Jarvis puede sugerir / ejecutar en automático) */
    'operationMode',
    /** Origen del pedido: whatsapp, correo, llamada, manual, jarvis, etc. */
    'origenPedido',
    /** Origen estructurado: whatsapp | cliente_directo | interno | email */
    'origenSolicitud',
    /** whatsapp: número y nombre de contacto (entrada externa) */
    'whatsappContactoNumero',
    'whatsappContactoNombre',
    'entradaExterna',
    /** Romina | Gery — bandeja operativa derivada de tipoServicio */
    'bandejaAsignada',
    'notificacionAsignadaA',
    /** alta | media | baja */
    'prioridadOperativa',
    /** WhatsApp: pendiente de respuesta al cliente (simulado) */
    'pendienteRespuestaCliente',
    /** Quien asignó el técnico actual (Romina, Gery, Jarvis, sistema) */
    'asignadoPor',
    /** Responsable operativo actual (suele coincidir con técnico en terreno) */
    'responsableActual',
    'historial',
    'costoMateriales',
    'costoManoObra',
    'costoTraslado',
    'costoOtros',
    'costoTotal',
    'montoCobrado',
    'utilidad',
    'pdfName',
    'pdfUrl',
    'equipos',
    'fotografiasAntes',
    'fotografiasDurante',
    'fotografiasDespues',
    /** Trazabilidad Motor Jarvis Operativo v1 (objeto JSON, backward compatible) */
    'jarvisIntakeTrace',
    /** Bandeja Base Maestra: pendiente | en_proceso | gestionado | cerrado */
    'estadoOperativo',
    /** Documento MDOC-* que originó la OT (si aplica) */
    'maestroDocumentoOrigenId',
    /** Valorización automática Jarvis / intake (CLP, estimado) */
    'montoEstimado',
    'margenEstimado',
  ],
  statusOptions: ['nueva', 'asignada', 'en_proceso', 'pendiente_validacion', 'cerrada', 'finalizada', 'facturada'],
  origenSolicitudOptions: ['whatsapp', 'cliente_directo', 'interno', 'email', 'llamada'],
  prioridadOperativaOptions: ['alta', 'media', 'baja'],
  operationModes: ['manual', 'automatic'],
  serviceTypes: ['clima', 'flota', 'comercial', 'administrativo'],
  equipoEstadoOptions: ['operativo', 'mantenimiento', 'falla'],
  maxEquipos: 12,
};
