/** Misma lógica que en ot.service — evita acoplar el ciclo Jarvis al servicio completo. */

const blockHasPhoto = (arr) =>
  Array.isArray(arr) && arr.some((e) => typeof e?.url === 'string' && e.url.trim().length > 0);

const getEquipoBlock = (eq, phase) => {
  const ev = eq?.evidencias;
  if (ev && typeof ev === 'object' && Array.isArray(ev[phase])) {
    return ev[phase];
  }
  if (phase === 'antes') return eq?.fotografiasAntes;
  if (phase === 'durante') return eq?.fotografiasDurante;
  return eq?.fotografiasDespues;
};

export const getEvidenceGapsForOt = (ot) => {
  const gaps = [];
  const eqs = ot?.equipos || [];
  if (eqs.length > 0) {
    eqs.forEach((eq, idx) => {
      const name = String(eq?.nombreEquipo || '').trim() || `Equipo ${idx + 1}`;
      if (!blockHasPhoto(getEquipoBlock(eq, 'antes'))) {
        gaps.push({ equipo: name, blockLabel: 'ANTES' });
      }
      if (!blockHasPhoto(getEquipoBlock(eq, 'durante'))) {
        gaps.push({ equipo: name, blockLabel: 'DURANTE' });
      }
      if (!blockHasPhoto(getEquipoBlock(eq, 'despues'))) {
        gaps.push({ equipo: name, blockLabel: 'DESPUÉS' });
      }
    });
    return gaps;
  }
  if (!blockHasPhoto(ot?.fotografiasAntes)) {
    gaps.push({ scope: 'OT', blockLabel: 'ANTES' });
  }
  if (!blockHasPhoto(ot?.fotografiasDurante)) {
    gaps.push({ scope: 'OT', blockLabel: 'DURANTE' });
  }
  if (!blockHasPhoto(ot?.fotografiasDespues)) {
    gaps.push({ scope: 'OT', blockLabel: 'DESPUÉS' });
  }
  return gaps;
};
