/** Técnicos frecuentes + valor libre «Otro» en UI Clima. */
export const HNF_OT_TECNICOS_PRESETS = [
  { value: 'Bernabé', label: 'Bernabé' },
  { value: 'Andrés', label: 'Andrés' },
  { value: 'Yohantan', label: 'Yohantan' },
  { value: 'Por asignar', label: 'Por asignar' },
];

/** Origen obligatorio en alta OT (control operativo). */
export const HNF_OT_ORIGEN_SOLICITUD = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'cliente_directo', label: 'Cliente directo' },
  { value: 'interno', label: 'Interno' },
  { value: 'email', label: 'Email' },
  { value: 'llamada', label: 'Llamada' },
];

export const HNF_OT_PRIORIDAD_OPERATIVA = [
  { value: 'baja', label: 'Prioridad baja' },
  { value: 'media', label: 'Prioridad media' },
  { value: 'alta', label: 'Prioridad alta' },
];

export const HNF_OT_ORIGEN_PEDIDO = [
  { value: '', label: '— (sin especificar)' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'correo', label: 'Correo' },
  { value: 'llamada', label: 'Llamada' },
  { value: 'manual', label: 'Manual / mostrador' },
  { value: 'jarvis', label: 'Jarvis (automático)' },
];

export const HNF_OT_OPERATION_MODES = [
  { value: 'manual', label: 'Manual (control humano)' },
  { value: 'automatic', label: 'Automático (Jarvis asigna si falta técnico)' },
];

export const labelOrigenPedido = (v) =>
  HNF_OT_ORIGEN_PEDIDO.find((o) => o.value === v)?.label || v || '—';

export const labelOrigenSolicitud = (v) =>
  HNF_OT_ORIGEN_SOLICITUD.find((o) => o.value === v)?.label || v || '—';

export const labelPrioridadOperativa = (v) =>
  HNF_OT_PRIORIDAD_OPERATIVA.find((o) => o.value === v)?.label || v || '—';

export const labelOperationMode = (m) =>
  m === 'automatic' ? 'Automático (Jarvis)' : 'Manual';
