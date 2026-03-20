import { otModel } from '../models/ot.model.js';

export const validateOTPayload = (payload = {}) => {
  const errors = [];

  if (!payload.cliente && !payload.clienteRelacionado) {
    errors.push('Debe informar cliente o clienteRelacionado.');
  }

  if (!payload.tipoServicio) {
    errors.push('El tipo de servicio es obligatorio.');
  } else if (!otModel.serviceTypes.includes(payload.tipoServicio)) {
    errors.push(`Tipo de servicio inválido. Valores permitidos: ${otModel.serviceTypes.join(', ')}.`);
  }

  if (!payload.fecha) {
    errors.push('La fecha es obligatoria.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
