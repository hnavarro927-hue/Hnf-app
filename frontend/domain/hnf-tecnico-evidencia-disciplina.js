/**
 * Disciplina de técnicos (Clima): cumplimiento de evidencia antes / durante / después por OT.
 * Usa la misma regla que el cierre de OT (`getEvidenceGaps` en ot-evidence.js).
 */

import { getEvidenceGaps } from '../utils/ot-evidence.js';

/** Mínimo de OT evaluables por técnico para considerar alerta de bajo cumplimiento. */
export const DISCIPLINA_MIN_OTS_ALERTA = 2;

/** Por debajo de este % (con mínimo de OT) se dispara alerta. */
export const DISCIPLINA_UMBRAL_BAJO_PCT = 60;

/**
 * Solo OT Clima con técnico asignado real (misma idea que responsable en cierre).
 */
export function otElegibleDisciplinaClima(ot) {
  if (String(ot?.tipoServicio || 'clima').toLowerCase().trim() !== 'clima') return false;
  const t = String(ot?.tecnicoAsignado || '').trim();
  if (!t) return false;
  if (t.toLowerCase() === 'por asignar') return false;
  return true;
}

export function clasificarEvidenciaOt(ot) {
  const gaps = getEvidenceGaps(ot);
  return {
    completa: gaps.length === 0,
    gapsCount: gaps.length,
    gaps,
  };
}

/**
 * @param {unknown[]} ots
 * @param {{ minOtsForAlert?: number, lowComplianceThresholdPct?: number }} [options]
 */
export function buildDisciplinaTecnicosSnapshot(ots, options = {}) {
  const list = Array.isArray(ots) ? ots : [];
  const minOtsForAlert = options.minOtsForAlert ?? DISCIPLINA_MIN_OTS_ALERTA;
  const lowComplianceThresholdPct = options.lowComplianceThresholdPct ?? DISCIPLINA_UMBRAL_BAJO_PCT;

  /** @type {Map<string, { tecnico: string, total: number, completas: number, incompletas: number, otsIncompletas: { id: string, gapsCount: number, estado: string }[] }>} */
  const byTech = new Map();

  for (const ot of list) {
    if (!otElegibleDisciplinaClima(ot)) continue;
    const name = String(ot.tecnicoAsignado).trim();
    if (!byTech.has(name)) {
      byTech.set(name, {
        tecnico: name,
        total: 0,
        completas: 0,
        incompletas: 0,
        otsIncompletas: [],
      });
    }
    const row = byTech.get(name);
    row.total += 1;
    const { completa, gapsCount } = clasificarEvidenciaOt(ot);
    if (completa) {
      row.completas += 1;
    } else {
      row.incompletas += 1;
      row.otsIncompletas.push({
        id: String(ot.id || '—'),
        gapsCount,
        estado: String(ot.estado || '—'),
      });
    }
  }

  const rows = [...byTech.values()]
    .map((r) => ({
      ...r,
      porcentajeCumplimiento:
        r.total === 0 ? null : Math.round((r.completas / r.total) * 1000) / 10,
    }))
    .sort((a, b) => a.tecnico.localeCompare(b.tecnico, 'es'));

  const alertasBajoCumplimiento = rows.filter(
    (r) =>
      r.total >= minOtsForAlert &&
      r.porcentajeCumplimiento != null &&
      r.porcentajeCumplimiento < lowComplianceThresholdPct
  );

  const totalOts = rows.reduce((s, r) => s + r.total, 0);
  const completas = rows.reduce((s, r) => s + r.completas, 0);

  return {
    rows,
    alertasBajoCumplimiento,
    global: {
      totalOts,
      completas,
      incompletas: totalOts - completas,
      porcentajeCumplimiento:
        totalOts === 0 ? null : Math.round((completas / totalOts) * 1000) / 10,
    },
    params: { minOtsForAlert, lowComplianceThresholdPct },
  };
}
