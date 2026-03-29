/**
 * Flujo OT estándar HNF y detección de pasos omitidos.
 */

import { computeCopilotOperationalTrace, describeProcessGap } from '../jarvis-copilot-trace.js';
import { getEvidenceGaps } from '../../utils/ot-evidence.js';

export const HNF_OT_FLOW_RULES_VERSION = '2026-03-27-v1';

export const HNF_OT_FLOW_CHAIN = [
  'Solicitud',
  'Clasificación',
  'Asignación',
  'Ejecución',
  'Informe',
  'Cierre',
];

function cardByOtId(cards, otId) {
  const id = String(otId || '').trim();
  if (!id) return null;
  for (const c of Array.isArray(cards) ? cards : []) {
    if (String(c?.otId || '').trim() === id) return c;
  }
  return null;
}

function isAbierta(ot) {
  const st = String(ot?.estado || '').toLowerCase();
  return st && !['terminado', 'cerrada', 'cerrado', 'cancelado'].includes(st);
}

/**
 * @returns {{ otId: string, gap: string, traceLabel: string }[]}
 */
export function listOtFlowGaps(ots, controlCards = []) {
  const list = Array.isArray(ots) ? ots.filter(isAbierta) : [];
  const out = [];
  for (const ot of list) {
    const ctrl = cardByOtId(controlCards, ot?.id);
    const trace = computeCopilotOperationalTrace(ot, ctrl);
    const gap = describeProcessGap(ot, trace);
    if (gap) {
      out.push({
        otId: String(ot?.id || '—'),
        cliente: String(ot?.cliente || '').trim(),
        gap,
        traceLabel: trace.currentLabel,
      });
    }
    const sinPdf = !String(ot?.pdfUrl || '').trim();
    const st = String(ot?.estado || '').toLowerCase();
    if (['terminado', 'cerrada', 'cerrado'].includes(st) && sinPdf) {
      out.push({
        otId: String(ot?.id || '—'),
        cliente: String(ot?.cliente || '').trim(),
        gap: 'OT en cierre sin PDF de informe registrado.',
        traceLabel: 'Informe',
      });
    }
  }
  return out;
}

export function otMissingReportForClosure(ot) {
  const gaps = getEvidenceGaps(ot);
  const sinResumen = !String(ot?.resumenTrabajo || '').trim();
  return gaps.length > 0 || sinResumen || !String(ot?.pdfUrl || '').trim();
}
