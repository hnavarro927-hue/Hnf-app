import { gestionModel } from '../models/gestion.model.js';

export const validateGestionPayload = (payload = {}) => {
  const errors = [];

  ['fecha', 'cliente', 'patente', 'servicio', 'tecnico'].forEach((field) => {
    if (!payload[field]) {
      errors.push(`El campo ${field} es obligatorio.`);
    }
  });

  if (!payload.tipo || !gestionModel.typeOptions.includes(payload.tipo)) {
    errors.push(`Tipo inválido. Valores permitidos: ${gestionModel.typeOptions.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
};
