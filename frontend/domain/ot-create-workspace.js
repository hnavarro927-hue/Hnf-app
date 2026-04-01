/**
 * OT Creation Workspace — etapas, validación por paso y armado de payload (Clima).
 * No bloquea avance por campos secundarios; lo crítico para API se valida por etapa / submit.
 */

const q = (form, name) => String(form?.elements?.[name]?.value ?? '').trim();

export const OT_CREATE_WORKSPACE_STAGES = [
  { id: 'cliente', label: 'Cliente' },
  { id: 'visita', label: 'Visita' },
  { id: 'pedido', label: 'Pedido' },
  { id: 'notas', label: 'Notas' },
  { id: 'equipos', label: 'Equipos' },
  { id: 'listo', label: 'Listo' },
];

export const OT_CREATE_WORKSPACE_STAGE_COUNT = OT_CREATE_WORKSPACE_STAGES.length;

/**
 * Validación al pulsar Siguiente (solo etapa actual).
 * @returns {{ ok: boolean, errors: Record<string, string> }}
 */
export function validateOtCreateWorkspaceStage(form, stageIndex) {
  const errors = {};
  const set = (name, msg) => {
    errors[name] = msg;
  };

  if (stageIndex === 0) {
    if (!q(form, 'cliente')) set('cliente', 'Indicá el cliente.');
    if (!q(form, 'direccion')) set('direccion', 'Indicá la dirección.');
    if (!q(form, 'comuna')) set('comuna', 'Indicá la comuna.');
    if (!q(form, 'contactoTerreno')) set('contactoTerreno', 'Indicá quién recibe al técnico.');
    if (!q(form, 'telefonoContacto')) set('telefonoContacto', 'El teléfono es obligatorio para registrar la OT.');
  }

  if (stageIndex === 1) {
    if (!q(form, 'fecha')) set('fecha', 'Elegí la fecha de la visita.');
    if (!q(form, 'hora')) set('hora', 'Elegí la hora.');
    if (!q(form, 'tipoServicio')) set('tipoServicio', 'Elegí el tipo de servicio.');
    if (!q(form, 'subtipoServicio')) set('subtipoServicio', 'Indicá el subtipo o trabajo a realizar.');
  }

  if (stageIndex === 2) {
    if (!q(form, 'origenPedidoWs')) set('origenPedidoWs', 'Indicá cómo entró el pedido.');
    const os = q(form, 'origenSolicitudCreate');
    if (!os) {
      const el = form.elements.origenSolicitudCreate;
      if (el) el.value = 'cliente_directo';
    }
    const pr = q(form, 'prioridadOperativaCreate');
    if (!pr) {
      const el = form.elements.prioridadOperativaCreate;
      if (el) el.value = 'media';
    }
    const orig = q(form, 'origenSolicitudCreate') || 'cliente_directo';
    if (orig === 'whatsapp') {
      if (!q(form, 'whatsappNumeroCreate')) set('whatsappNumeroCreate', 'Con WhatsApp, el número es obligatorio.');
      if (!q(form, 'whatsappNombreCreate')) set('whatsappNombreCreate', 'Con WhatsApp, el nombre es obligatorio.');
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Antes de enviar al servidor (incluye reglas API).
 */
export function validateOtCreateWorkspaceSubmit(form) {
  const errors = {};
  for (let s = 0; s <= 2; s++) {
    const v = validateOtCreateWorkspaceStage(form, s);
    Object.assign(errors, v.errors);
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Map de campo → etapa del workspace (0–2) para navegar tras fallo de submit. */
const SUBMIT_ERROR_FIELD_STAGE = {
  cliente: 0,
  direccion: 0,
  comuna: 0,
  contactoTerreno: 0,
  telefonoContacto: 0,
  clienteEmailCreate: 0,
  sucursalCreate: 0,
  fecha: 1,
  hora: 1,
  tipoServicio: 1,
  subtipoServicio: 1,
  prioridadOperativaCreate: 1,
  origenSolicitudCreate: 1,
  origenPedidoWs: 2,
  whatsappNumeroCreate: 2,
  whatsappNombreCreate: 2,
  responsableHnfWs: 2,
  canalWs: 2,
  tecnicoPreset: 2,
  tecnicoOtro: 2,
  coordObsCreate: 2,
  operationModeWs: 2,
  otCustomId: 2,
};

/**
 * Primera etapa (0–2) que contiene algún error de submit; si no hay mapeo, 2 (Pedido).
 */
export function getOtCreateWorkspaceStageForSubmitErrors(errors) {
  let min = null;
  for (const key of Object.keys(errors || {})) {
    const s = SUBMIT_ERROR_FIELD_STAGE[key];
    if (typeof s === 'number' && (min === null || s < min)) min = s;
  }
  return min ?? 2;
}

/**
 * Ensambla payload compatible con create OT + merges de campos UI extra.
 */
export function buildOtCreateWorkspacePayload(form, equipos, resolveTecnico) {
  const origenSolicitud = q(form, 'origenSolicitudCreate') || 'cliente_directo';
  const origenPedido = q(form, 'origenPedidoWs') || origenSolicitud;
  const waNum = q(form, 'whatsappNumeroCreate');
  const waNom = q(form, 'whatsappNombreCreate');

  const email = q(form, 'clienteEmailCreate');
  const sucursal = q(form, 'sucursalCreate');
  const canal = q(form, 'canalWs');
  const responsableHnf = q(form, 'responsableHnfWs');
  const coordObs = q(form, 'coordObsCreate');

  let observaciones = '';
  const obsInt = q(form, 'observacionesInternaWs');
  const meta = [];
  if (email) meta.push(`Email contacto: ${email}`);
  if (sucursal) meta.push(`Sucursal / tienda: ${sucursal}`);
  if (canal) meta.push(`Canal: ${canal}`);
  if (responsableHnf) meta.push(`Responsable HNF: ${responsableHnf}`);
  if (coordObs) meta.push(`Coordinación: ${coordObs}`);
  if (obsInt) meta.push(`Nota interna: ${obsInt}`);
  if (meta.length) {
    observaciones = [meta.join('\n'), observaciones].filter(Boolean).join('\n\n');
  }

  const reqCliente = q(form, 'reqClienteWs');
  let recomendaciones = q(form, 'recomendaciones');
  if (reqCliente) {
    recomendaciones = [reqCliente, recomendaciones].filter(Boolean).join('\n\n');
  }

  const tipoFact = q(form, 'tipoFacturacionWs');
  const refFact = q(form, 'refFacturacionWs');
  const customId = q(form, 'otCustomId');

  const payload = {
    ...(customId ? { id: customId } : {}),
    cliente: q(form, 'cliente'),
    direccion: q(form, 'direccion'),
    comuna: q(form, 'comuna'),
    contactoTerreno: q(form, 'contactoTerreno'),
    telefonoContacto: q(form, 'telefonoContacto'),
    tipoServicio: form.elements.tipoServicio?.value || '',
    subtipoServicio: q(form, 'subtipoServicio'),
    fecha: form.elements.fecha?.value || '',
    hora: form.elements.hora?.value || '',
    observaciones,
    resumenTrabajo: q(form, 'resumenTrabajo'),
    recomendaciones,
    origenSolicitud,
    origenPedido,
    prioridadOperativa: q(form, 'prioridadOperativaCreate') || 'media',
    whatsappContactoNumero: waNum,
    whatsappContactoNombre: waNom,
    operationMode: form.elements.operationModeWs?.value || 'manual',
    tecnicoAsignado: typeof resolveTecnico === 'function' ? resolveTecnico(form) : 'Por asignar',
    equipos: Array.isArray(equipos) ? equipos : [],
  };

  if (tipoFact === 'mensual' || tipoFact === 'inmediata') {
    payload.tipoFacturacion = tipoFact;
  }
  if (refFact) {
    payload.tiendaNombre = refFact;
  }

  return payload;
}
