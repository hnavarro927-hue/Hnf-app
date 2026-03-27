/**
 * HNF Intelligence Base V1 — reglas de asignación (Clima / Flota, subtipo, zona).
 * Sugerencias; la ejecución real respeta operationMode manual vs automático en OT.
 */

export const HNF_ASSIGNMENT_RULES_VERSION = '2026-03-27-v1';

/** Referencias operativas nombradas (expandir desde directorio real cuando exista API). */
export const NAMED_FIELD_RESOURCES = [
  {
    id: 'bernabe',
    nombres: ['bernabé', 'bernabe'],
    areas: ['clima'],
    zonas: ['rm', 'santiago', 'maipú', 'maipu', 'cencosud'],
    subtiposPreferidos: ['emergencia', 'mantención correctiva', 'visita técnica', 'emergencia'],
  },
  {
    id: 'andres',
    nombres: ['andrés', 'andres'],
    areas: ['clima', 'flota'],
    zonas: ['rm', 'sur', 'ruta'],
    subtiposPreferidos: ['traslado', 'revisión técnica', 'asistencia puntual', 'visita técnica'],
  },
  {
    id: 'yohnatan',
    nombres: ['yohnatan', 'jonatan', 'jonathan'],
    areas: ['clima'],
    zonas: ['norte', 'rm', 'quilicura', 'conchali'],
    subtiposPreferidos: ['mantención preventiva', 'mantención correctiva', 'visita técnica'],
  },
];

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * @param {object} ot
 * @param {{ operationMode?: string }} [opts]
 * @returns {{ suggest: string|null, rationale: string, canAutoApply: boolean }}
 */
export function suggestAssignmentForOt(ot, opts = {}) {
  const area = String(ot?.tipoServicio || 'clima').toLowerCase() === 'flota' ? 'flota' : 'clima';
  const sub = norm(ot?.subtipoServicio || ot?.tipoServicio || '');
  const comuna = norm(ot?.comuna || '');
  const zonaBlob = `${comuna} ${norm(ot?.direccion || '')}`;

  const emergencia = /emergencia|urgencia|crit/.test(sub + norm(ot?.observaciones || ''));
  const candidates = [];

  for (const r of NAMED_FIELD_RESOURCES) {
    if (!r.areas.includes(area)) continue;
    const zoneHit = r.zonas.some((z) => zonaBlob.includes(z));
    const subHit = r.subtiposPreferidos.some((s) => sub.includes(norm(s)) || norm(s).includes(sub));
    let score = 0;
    if (zoneHit) score += 2;
    if (subHit) score += 2;
    if (emergencia && r.id === 'bernabe') score += 1;
    if (score > 0) candidates.push({ id: r.id, score, label: r.nombres[0] });
  }
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const mode = String(opts.operationMode || ot?.operationMode || 'manual').toLowerCase();
  const canAutoApply = mode === 'automatic' && Boolean(top);

  return {
    suggest: top ? top.label.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    rationale: top
      ? `Coincidencia por área ${area}, zona/comuna y subtipo operativo (regla HNF v1).`
      : 'Sin coincidencia fuerte de zona/subtipo en tabla v1; asignar por directorio o criterio de mando.',
    canAutoApply,
  };
}
