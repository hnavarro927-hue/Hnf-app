import { expenseModel } from '../models/expense.model.js';

export const validateExpensePatch = (payload = {}) => {
  const errors = [];
  const e = String(payload.estadoAprobacion || '').toLowerCase();
  if (e && !expenseModel.estadoAprobacionOptions.includes(e)) {
    errors.push(`estadoAprobacion inválido. Valores: ${expenseModel.estadoAprobacionOptions.join(', ')}.`);
  }
  if (payload.observacionFinanzas != null && String(payload.observacionFinanzas).length > 2000) {
    errors.push('observacionFinanzas: máximo 2000 caracteres.');
  }
  if (payload.devolverA != null && String(payload.devolverA).length > 120) {
    errors.push('devolverA: máximo 120 caracteres.');
  }
  return { valid: errors.length === 0, errors };
};

export const validateExpensePayload = (payload = {}) => {
  const errors = [];

  if (!payload.fecha) {
    errors.push('La fecha es obligatoria.');
  }

  if (!payload.categoria) {
    errors.push('La categoría es obligatoria.');
  }

  if (payload.monto === undefined || Number(payload.monto) <= 0) {
    errors.push('El monto debe ser mayor a 0.');
  }

  if (!payload.descripcion) {
    errors.push('La descripción es obligatoria.');
  }

  if (!payload.centroCosto) {
    errors.push('El centro de costo es obligatorio.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
