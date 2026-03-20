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
    errors.push(`Tipo de servicio inválido. Valores permitidos: ${otModel.serviceTypes.join(', ')}.`);
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
