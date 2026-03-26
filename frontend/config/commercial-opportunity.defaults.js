/**
 * Bases editables (CLP). Sincronizar con backend/src/config/commercialOpportunity.defaults.js
 */
export const OPPORTUNITY_VALUE_BASES = {
  urgencia: { monto: 850000, etiqueta: 'Intervención correctiva prioritaria' },
  reparacion: { monto: 520000, etiqueta: 'Reparación / correctivo estimado' },
  mejora: { monto: 350000, etiqueta: 'Mejora / upgrade' },
  mantenimiento: { monto: 120000, etiqueta: 'Recurrente mensual (referencia)' },
};
