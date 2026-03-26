/**
 * Entidad única HNF CORE — Solicitud (origen → cierre con trazabilidad).
 */

export const HNF_CORE_ORIGENES = ['whatsapp', 'correo', 'manual'];

export const HNF_CORE_TIPOS = ['clima', 'flota', 'comercial', 'control'];

/** Flujo operativo interno (checklist) */
export const HNF_CORE_ETAPAS_CHECKLIST = [
  'ingreso',
  'diagnostico',
  'ejecucion',
  'informe',
  'aprobacion',
  'envio',
];

/**
 * Estados de ciclo de vida (snake_case en API).
 * UI puede mostrar mayúsculas.
 */
export const HNF_CORE_ESTADOS = [
  'recibido',
  'en_proceso',
  'pendiente_aprobacion',
  'observado',
  'aprobado',
  'enviado',
  'cerrado',
];

export const hnfCoreSolicitudModel = {
  id: 'string',
  cliente: 'string',
  tipo: `enum: ${HNF_CORE_TIPOS.join('|')}`,
  origen: `enum: ${HNF_CORE_ORIGENES.join('|')}`,
  fecha: 'string (ISO)',
  responsable: 'string',
  estado: `enum: ${HNF_CORE_ESTADOS.join('|')}`,
  prioridad: 'enum: baja|media|alta|critica',
  descripcion: 'string',
  checklist: 'Record<etapa, boolean>',
  historial: 'array',
  createdAt: 'string',
  updatedAt: 'string',
  metadata: 'object (opcional)',
};
