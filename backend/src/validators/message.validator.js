import { messageModel } from '../models/message.model.js';

export const validateMessagePayload = (payload = {}) => {
  const errors = [];

  if (!payload.fuente || !messageModel.sourceOptions.includes(payload.fuente)) {
    errors.push(`Fuente inválida. Valores permitidos: ${messageModel.sourceOptions.join(', ')}.`);
  }

  if (!payload.remitente) {
    errors.push('El remitente es obligatorio.');
  }

  if (!payload.nombre) {
    errors.push('El nombre del remitente es obligatorio.');
  }

  if (!payload.mensaje) {
    errors.push('El mensaje es obligatorio.');
  }

  return { valid: errors.length === 0, errors };
};
