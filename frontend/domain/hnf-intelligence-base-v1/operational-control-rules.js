/**
 * Monitoreo operativo agregado — sin técnico, sin informe, urgentes, repetidos, carga.
 */

import { getEvidenceGaps } from '../../utils/ot-evidence.js';

export const HNF_OPERATIONAL_CONTROL_VERSION = '2026-03-27-v1';

function isAbierta(ot) {
  const st = String(ot?.estado || '').toLowerCase();
  return st && !['terminado', 'cerrado', 'cancelado'].includes(st);
}

function sinTec(ot) {
  const t = String(ot?.tecnicoAsignado || '').trim().toLowerCase();
  return !t || t === 'sin asignar' || t === 'por asignar';
}

function isUrgent(ot) {
  const b = `${ot?.observaciones || ''}`.toLowerCase();
  return /\burgent|emergencia|crític|critico\b/i.test(b);
}

/**
 * @param {object[]} ots
 */
export function buildOperationalControlSnapshot(ots) {
  const list = Array.isArray(ots) ? ots.filter(isAbierta) : [];
  const sinTecnico = list.filter(sinTec);
  const urgentes = list.filter(isUrgent);
  const sinInforme = list.filter(
    (o) => !String(o?.pdfUrl || '').trim() || getEvidenceGaps(o).length > 0
  );

  const byCliente = new Map();
  for (const o of list) {
    const c = String(o?.cliente || '').trim() || '—';
    byCliente.set(c, (byCliente.get(c) || 0) + 1);
  }
  const repeatedIncidents = [...byCliente.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ cliente: name, count: n }));

  const byTech = new Map();
  for (const o of list) {
    if (sinTec(o)) continue;
    const t = String(o.tecnicoAsignado).trim();
    byTech.set(t, (byTech.get(t) || 0) + 1);
  }
  const overloaded = [...byTech.entries()]
    .filter(([, n]) => n >= 6)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, count]) => ({ nombre, count }));

  return {
    totalAbiertas: list.length,
    sinTecnico: sinTecnico.length,
    urgentes: urgentes.length,
    sinInformePdfOEvidencia: sinInforme.length,
    repeatedIncidents,
    overloadedTechnicians: overloaded,
  };
}
