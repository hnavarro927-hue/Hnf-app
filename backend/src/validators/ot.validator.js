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
