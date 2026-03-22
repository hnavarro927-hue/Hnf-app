export const BLOCK_LABELS = {
  antes: 'ANTES',
  durante: 'DURANTE',
  despues: 'DESPUÉS',
};

export const EVIDENCIA_PHASES = ['antes', 'durante', 'despues'];

/** Lista de evidencias del equipo para validación UI: prioriza `evidencias.*`, si no hay objeto usa legado `fotografias*`. */
export const getEquipoEvidenceBlock = (eq, phase) => {
  const ev = eq?.evidencias;
  if (ev && typeof ev === 'object' && Array.isArray(ev[phase])) {
    return ev[phase];
  }
  const legacy =
    phase === 'antes'
      ? eq?.fotografiasAntes
      : phase === 'durante'
        ? eq?.fotografiasDurante
        : eq?.fotografiasDespues;
  return Array.isArray(legacy) ? legacy : [];
};

/**
 * Solo para PDF cuando hay equipos: usa exclusivamente `equipo.evidencias.{antes,durante,despues}`.
 * Si la OT no tiene aún ese objeto (JSON viejo), cae a fotografías por equipo (nunca mezcla con raíz de la OT).
 */
export const getPdfEquipoEvidenceBlock = (eq, phase) => {
  const ev = eq?.evidencias;
  if (ev && typeof ev === 'object') {
    const arr = ev[phase];
    return Array.isArray(arr) ? arr : [];
  }
  return getEquipoEvidenceBlock(eq, phase);
};

export const evidenceBlockHasPhoto = (arr) =>
  Array.isArray(arr) &&
  arr.some((e) => typeof e?.url === 'string' && e.url.trim().length > 0);

export const getEvidenceGaps = (ot) => {
  const gaps = [];
  const eqs = ot?.equipos || [];
  if (eqs.length > 0) {
    eqs.forEach((eq, idx) => {
      const name = (eq?.nombreEquipo || '').trim() || `Equipo ${idx + 1}`;
      if (!evidenceBlockHasPhoto(getEquipoEvidenceBlock(eq, 'antes'))) {
        gaps.push({ equipo: name, block: 'antes', blockLabel: BLOCK_LABELS.antes });
      }
      if (!evidenceBlockHasPhoto(getEquipoEvidenceBlock(eq, 'durante'))) {
        gaps.push({ equipo: name, block: 'durante', blockLabel: BLOCK_LABELS.durante });
      }
      if (!evidenceBlockHasPhoto(getEquipoEvidenceBlock(eq, 'despues'))) {
        gaps.push({ equipo: name, block: 'despues', blockLabel: BLOCK_LABELS.despues });
      }
    });
    return gaps;
  }
  if (!evidenceBlockHasPhoto(ot?.fotografiasAntes)) {
    gaps.push({ scope: 'OT', block: 'antes', blockLabel: BLOCK_LABELS.antes });
  }
  if (!evidenceBlockHasPhoto(ot?.fotografiasDurante)) {
    gaps.push({ scope: 'OT', block: 'durante', blockLabel: BLOCK_LABELS.durante });
  }
  if (!evidenceBlockHasPhoto(ot?.fotografiasDespues)) {
    gaps.push({ scope: 'OT', block: 'despues', blockLabel: BLOCK_LABELS.despues });
  }
  return gaps;
};

export const otHasCloseEvidence = (ot) => getEvidenceGaps(ot).length === 0;

export const formatEvidenceGapsMessage = (gaps) => {
  if (!gaps?.length) return '';
  return gaps
    .map((g) =>
      g.scope === 'OT'
        ? `En la visita general falta al menos una foto en el bloque ${g.blockLabel}.`
        : `En «${g.equipo}» falta al menos una foto en el bloque ${g.blockLabel}.`
    )
    .join(' ');
};
