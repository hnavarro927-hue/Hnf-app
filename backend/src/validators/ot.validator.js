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

  if (!payload.fecha) {
    errors.push('La fecha es obligatoria.');
  }

  if (!payload.hora) {
    errors.push('La hora es obligatoria.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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
