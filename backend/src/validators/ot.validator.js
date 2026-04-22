import { otModel } from '../models/ot.model.js';

export const validateOTPayload = (payload = {}) => {
  const errors = [];

  if (!payload.cliente?.nombre) {
    errors.push('Debe informar cliente.nombre.');
  }

  if (!payload.servicio?.tecnico) {
    errors.push('Debe informar servicio.tecnico.');
  }

  if (!payload.servicio?.horaInicio || !payload.servicio?.horaTermino) {
    errors.push('Debe informar servicio.horaInicio y servicio.horaTermino.');
  }

  if (typeof payload.costos?.totalNeto !== 'number' || Number.isNaN(payload.costos.totalNeto)) {
    errors.push('Debe informar costos.totalNeto numérico.');
  }

  if (!payload.control?.estado || !otModel.statusOptions.includes(payload.control.estado)) {
    errors.push(`Estado inválido. Valores permitidos: ${otModel.statusOptions.join(', ')}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
