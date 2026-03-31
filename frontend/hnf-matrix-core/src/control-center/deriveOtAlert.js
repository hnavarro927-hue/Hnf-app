import { alertaOperativaVisual } from '../../../domain/hnf-operativa-reglas.js';

/**
 * Alerta compacta para card — delega en dominio HNF (riesgo rojo / atraso amarillo con umbrales opcionales).
 * @param {Record<string, unknown>} ot
 * @param {{ diasAtrasoIngreso?: number, diasAtrasoPendienteLyn?: number, referenciaLynIso?: string }} [alertaOpts]
 * @returns {{ level: 'risk' | 'delay', text: string } | null}
 */
export function deriveOtAlert(ot, alertaOpts) {
  const a = alertaOperativaVisual(ot, alertaOpts);
  if (!a) return null;
  if (a.tipo === 'riesgo') return { level: 'risk', text: a.texto };
  return { level: 'delay', text: a.texto };
}
