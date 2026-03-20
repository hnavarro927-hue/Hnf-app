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
