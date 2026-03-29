import { otModel } from '../models/ot.model.js';

export const validateOTPayload = (payload = {}) => {
  const errors = [];

  if (!payload.cliente && !payload.clienteRelacionado) {
    errors.push('Debe informar cliente o clienteRelacionado.');
  }

  if (!payload.direccion) {
    errors.push('La dirección es obligatoria.');
  }

  if (!payload.comuna) {
    errors.push('La comuna es obligatoria.');
  }

  if (!payload.contactoTerreno) {
    errors.push('El contacto en terreno es obligatorio.');
  }

  if (!payload.telefonoContacto) {
    errors.push('El teléfono de contacto es obligatorio.');
  }

  if (!payload.tipoServicio) {
    errors.push('El tipo de servicio es obligatorio.');
  } else if (!otModel.serviceTypes.includes(payload.tipoServicio)) {
    errors.push(
      `Tipo de servicio inválido. Valores permitidos: ${otModel.serviceTypes.join(', ')}.`
    );
  }

  if (!payload.subtipoServicio) {
    errors.push('El subtipo de servicio es obligatorio.');
  }

  if (!payload.origenSolicitud || !otModel.origenSolicitudOptions.includes(payload.origenSolicitud)) {
    errors.push(
      `origenSolicitud es obligatorio. Valores: ${otModel.origenSolicitudOptions.join(', ')}.`
    );
  }

  if (!payload.prioridadOperativa || !otModel.prioridadOperativaOptions.includes(payload.prioridadOperativa)) {
    errors.push(
      `prioridadOperativa es obligatoria. Valores: ${otModel.prioridadOperativaOptions.join(', ')}.`
    );
  }

  if (payload.origenSolicitud === 'whatsapp') {
    if (!String(payload.whatsappContactoNumero || '').trim()) {
      errors.push('Con origen WhatsApp, el número de contacto es obligatorio.');
    }
    if (!String(payload.whatsappContactoNombre || '').trim()) {
      errors.push('Con origen WhatsApp, el nombre de contacto es obligatorio.');
    }
  }

  if (!payload.fecha) {
    errors.push('La fecha es obligatoria.');
  }

  if (!payload.hora) {
    errors.push('La hora es obligatoria.');
  }

  if (payload.id != null && String(payload.id).trim()) {
    const id = String(payload.id).trim();
    if (id.length < 2 || id.length > 64) {
      errors.push('El número / id de OT manual debe tener entre 2 y 64 caracteres.');
    } else if (!/^[A-Za-z0-9._-]+$/.test(id)) {
      errors.push('El id de OT solo puede usar letras, números, punto, guión y guión bajo.');
    }
  }

  if (payload.operationMode != null && String(payload.operationMode).trim()) {
    const m = String(payload.operationMode).trim();
    if (!otModel.operationModes.includes(m)) {
      errors.push(`Modo operación inválido. Valores: ${otModel.operationModes.join(', ')}.`);
    }
  }

  if (payload.origenPedido != null && String(payload.origenPedido).length > 120) {
    errors.push('Origen del pedido: máximo 120 caracteres.');
  }

  if (payload.jarvisIntakeTrace != null) {
    if (typeof payload.jarvisIntakeTrace !== 'object' || Array.isArray(payload.jarvisIntakeTrace)) {
      errors.push('jarvisIntakeTrace debe ser un objeto JSON.');
    } else {
      try {
        const s = JSON.stringify(payload.jarvisIntakeTrace);
        if (s.length > 14000) errors.push('jarvisIntakeTrace excede tamaño permitido.');
      } catch {
        errors.push('jarvisIntakeTrace no serializable.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateOperationalPatch = (payload = {}) => {
  const errors = [];
  const keys = ['operationMode', 'tecnicoAsignado', 'origenPedido', 'responsableActual', 'pendienteRespuestaCliente'];
  const hasAny = keys.some((k) => k in payload);
  if (!hasAny) {
    errors.push(
      'Enviá al menos uno de: operationMode, tecnicoAsignado, origenPedido, responsableActual, pendienteRespuestaCliente.'
    );
  }
  if ('operationMode' in payload && payload.operationMode != null) {
    const m = String(payload.operationMode).trim();
    if (!otModel.operationModes.includes(m)) {
      errors.push(`operationMode inválido. Valores: ${otModel.operationModes.join(', ')}.`);
    }
  }
  if ('tecnicoAsignado' in payload && payload.tecnicoAsignado != null) {
    if (typeof payload.tecnicoAsignado !== 'string') {
      errors.push('tecnicoAsignado debe ser texto.');
    } else if (String(payload.tecnicoAsignado).length > 120) {
      errors.push('tecnicoAsignado: máximo 120 caracteres.');
    }
  }
  if ('origenPedido' in payload && payload.origenPedido != null) {
    if (typeof payload.origenPedido !== 'string') {
      errors.push('origenPedido debe ser texto.');
    } else if (String(payload.origenPedido).length > 120) {
      errors.push('origenPedido: máximo 120 caracteres.');
    }
  }
  if ('responsableActual' in payload && payload.responsableActual != null) {
    if (typeof payload.responsableActual !== 'string') {
      errors.push('responsableActual debe ser texto.');
    } else if (String(payload.responsableActual).length > 120) {
      errors.push('responsableActual: máximo 120 caracteres.');
    }
  }
  if ('pendienteRespuestaCliente' in payload && payload.pendienteRespuestaCliente != null) {
    if (typeof payload.pendienteRespuestaCliente !== 'boolean') {
      errors.push('pendienteRespuestaCliente debe ser booleano.');
    }
  }
  return { valid: errors.length === 0, errors };
};

const CORE_PATCH_KEYS = [
  'cliente',
  'direccion',
  'comuna',
  'contactoTerreno',
  'telefonoContacto',
  'tipoServicio',
  'subtipoServicio',
  'observaciones',
  'origenSolicitud',
  'origenPedido',
  'prioridadOperativa',
  'whatsappContactoNumero',
  'whatsappContactoNombre',
  'entradaExterna',
  'pendienteRespuestaCliente',
  'tipoFacturacion',
  'periodoFacturacion',
  'tiendaId',
  'tiendaNombre',
  'valorReferencialTienda',
  'incluidaEnCierreMensual',
  'cierreMensualId',
];

export const validateOTCorePatch = (payload = {}) => {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload inválido.');
    return { valid: false, errors };
  }
  const hasAny = CORE_PATCH_KEYS.some((k) => k in payload);
  if (!hasAny) {
    errors.push(`Enviá al menos uno de: ${CORE_PATCH_KEYS.join(', ')}.`);
  }
  if ('tipoServicio' in payload && payload.tipoServicio != null) {
    const t = String(payload.tipoServicio).trim();
    if (!otModel.serviceTypes.includes(t)) {
      errors.push(`tipoServicio inválido. Valores: ${otModel.serviceTypes.join(', ')}.`);
    }
  }
  if ('origenSolicitud' in payload && payload.origenSolicitud != null) {
    const o = String(payload.origenSolicitud).trim();
    if (!otModel.origenSolicitudOptions.includes(o)) {
      errors.push(`origenSolicitud inválido. Valores: ${otModel.origenSolicitudOptions.join(', ')}.`);
    }
  }
  if ('prioridadOperativa' in payload && payload.prioridadOperativa != null) {
    const p = String(payload.prioridadOperativa).trim();
    if (!otModel.prioridadOperativaOptions.includes(p)) {
      errors.push(`prioridadOperativa inválida. Valores: ${otModel.prioridadOperativaOptions.join(', ')}.`);
    }
  }
  if ('tipoFacturacion' in payload && payload.tipoFacturacion != null) {
    const tf = String(payload.tipoFacturacion).toLowerCase();
    if (!['inmediata', 'mensual'].includes(tf)) {
      errors.push('tipoFacturacion debe ser inmediata|mensual.');
    }
  }
  if ('periodoFacturacion' in payload && payload.periodoFacturacion != null) {
    const s = String(payload.periodoFacturacion).trim();
    if (s && !/^\d{4}-\d{2}$/.test(s)) {
      errors.push('periodoFacturacion debe ser YYYY-MM.');
    }
  }
  return { valid: errors.length === 0, errors };
};

const EVIDENCE_KEYS = ['fotografiasAntes', 'fotografiasDurante', 'fotografiasDespues'];

export const validateEvidencePatchBody = (payload = {}) => {
  const errors = [];
  const hasAny = EVIDENCE_KEYS.some((key) => Array.isArray(payload[key]));

  if (!hasAny) {
    errors.push('Debe enviar al menos un arreglo de evidencias (fotografiasAntes, fotografiasDurante o fotografiasDespues).');
  }

  for (const key of EVIDENCE_KEYS) {
    if (payload[key] === undefined) continue;
    if (!Array.isArray(payload[key])) {
      errors.push(`El campo ${key} debe ser un arreglo.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateEquiposPatchBody = (payload = {}) => {
  const errors = [];

  if (!Array.isArray(payload.equipos)) {
    errors.push('equipos debe ser un arreglo.');
    return { valid: false, errors };
  }

  if (payload.equipos.length > (otModel.maxEquipos ?? 12)) {
    errors.push(`Máximo ${otModel.maxEquipos ?? 12} equipos por OT.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateReportPayload = (payload = {}) => {
  const errors = [];

  if (!payload.pdfName || typeof payload.pdfName !== 'string' || !payload.pdfName.trim()) {
    errors.push('pdfName es obligatorio.');
  }

  if (!payload.pdfUrl || typeof payload.pdfUrl !== 'string' || !payload.pdfUrl.trim()) {
    errors.push('pdfUrl es obligatorio.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const VISIT_FIELD_KEYS = ['resumenTrabajo', 'recomendaciones', 'observaciones'];

export const validateVisitFieldsPatch = (payload = {}) => {
  const errors = [];
  const hasAny = VISIT_FIELD_KEYS.some((k) => k in payload);
  if (!hasAny) {
    errors.push('Enviá al menos uno de: resumenTrabajo, recomendaciones, observaciones.');
  }
  for (const k of VISIT_FIELD_KEYS) {
    if (!(k in payload)) continue;
    if (payload[k] !== null && typeof payload[k] !== 'string') {
      errors.push(`${k} debe ser texto.`);
    }
  }
  return { valid: errors.length === 0, errors };
};

const ECON_KEYS = ['costoMateriales', 'costoManoObra', 'costoTraslado', 'costoOtros', 'montoCobrado'];

export const validateEconomicsPatch = (payload = {}) => {
  const errors = [];
  const hasAny = ECON_KEYS.some((k) => k in payload);
  if (!hasAny) {
    errors.push('Enviá al menos uno de: costoMateriales, costoManoObra, costoTraslado, costoOtros, montoCobrado.');
  }
  for (const k of ECON_KEYS) {
    if (!(k in payload)) continue;
    const n = Number(payload[k]);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`${k} debe ser un número mayor o igual a 0.`);
    }
  }
  return { valid: errors.length === 0, errors };
};
