/**
 * Auditor de OT para agregados del panel gerencial (KPI) en Centro de control.
 * - Función pura; no persiste ni elimina datos.
 * - No aplicar al Kanban ni al drawer: solo exclusiones en sumas/conteos de KPI.
 *
 * Criterios:
 * - Palabras en texto (límites de palabra): test, demo, prueba (ES sin tildes en match).
 * - Campos revisados: id, cliente, subtipo, observaciones, resumen, recomendaciones, contacto, dirección, comuna.
 * - Flags en raíz o en jarvisIntakeTrace: esPrueba, esDemo, demo, otPrueba (boolean o "true"/1).
 */

const DEMO_WORD_RE = /\b(test|demo|prueba)\b/i;

function normalizeForMatch(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function truthyDemoFlag(v) {
  if (v === true) return true;
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === 'true' || s === '1' || s === 'si' || s === 'sí';
}

function hayMarcadorEstructural(ot) {
  if (!ot || typeof ot !== 'object') return false;
  if (
    truthyDemoFlag(ot.esPrueba) ||
    truthyDemoFlag(ot.esDemo) ||
    truthyDemoFlag(ot.demo) ||
    truthyDemoFlag(ot.otPrueba)
  ) {
    return true;
  }
  const j = ot.jarvisIntakeTrace;
  if (!j || typeof j !== 'object') return false;
  return (
    truthyDemoFlag(j.esPrueba) ||
    truthyDemoFlag(j.esDemo) ||
    truthyDemoFlag(j.demo) ||
    truthyDemoFlag(j.otPrueba)
  );
}

function hayPalabraDemoEnTexto(ot) {
  const chunks = [
    ot?.id,
    ot?.cliente,
    ot?.subtipoServicio,
    ot?.observaciones,
    ot?.resumenTrabajo,
    ot?.recomendaciones,
    ot?.contactoTerreno,
    ot?.direccion,
    ot?.comuna,
  ];
  const j = ot?.jarvisIntakeTrace;
  if (j && typeof j === 'object') {
    chunks.push(j.nota, j.notes, j.descripcion_breve);
  }
  const haystack = normalizeForMatch(chunks.filter(Boolean).join('\n'));
  return DEMO_WORD_RE.test(haystack);
}

/**
 * @param {Record<string, unknown> | null | undefined} ot
 * @returns {boolean} true = no debe entrar en agregados de KPI del Mando
 */
export function esOtExcluidaDeKpis(ot) {
  if (!ot || typeof ot !== 'object') return false;
  if (hayMarcadorEstructural(ot)) return true;
  if (hayPalabraDemoEnTexto(ot)) return true;
  return false;
}
