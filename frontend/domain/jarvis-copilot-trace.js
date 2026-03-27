/**
 * Trazas operativas ADN para el copiloto (misma lógica que el panel premium, sin acoplar al componente).
 */

import { getEvidenceGaps } from '../utils/ot-evidence.js';

export const COPILOT_ADN_STEPS = [
  { id: 'solicitud', label: 'Solicitud' },
  { id: 'clasificacion', label: 'Clasificación' },
  { id: 'asignacion', label: 'Asignación' },
  { id: 'ejecucion', label: 'Ejecución' },
  { id: 'informe', label: 'Informe' },
  { id: 'cierre', label: 'Cierre' },
];

/**
 * @param {object} ot
 * @param {object|null} ctrl
 */
export function computeCopilotOperationalTrace(ot, ctrl) {
  const st = String(ot?.estado || '').toLowerCase();
  const et1 = ctrl?.etapa1;
  const gaps0 = ctrl
    ? (et1?.gapsCount ?? 0) === 0
    : getEvidenceGaps(ot).length === 0;
  const pdfOk = Boolean(et1?.pdfOk || String(ot?.pdfUrl || '').trim());
  const hasTipo = Boolean(String(ot?.subtipoServicio || ot?.tipoServicio || '').trim());
  const techRaw = String(ot?.tecnicoAsignado || '').trim();
  const l = techRaw.toLowerCase();
  const hasTechOk =
    Boolean(techRaw) && l !== 'sin asignar' && l !== 'por asignar';
  const terminado = st === 'terminado' || st === 'cerrado';

  const completed = [true, hasTipo, hasTechOk, gaps0, pdfOk, terminado];
  let activeIdx = completed.findIndex((c) => !c);
  if (activeIdx === -1) activeIdx = COPILOT_ADN_STEPS.length - 1;

  const step = COPILOT_ADN_STEPS[activeIdx];
  return {
    completed,
    activeIdx,
    currentStageId: step.id,
    currentLabel: step.label,
    hasTipo,
    hasTech: hasTechOk,
    gaps0,
    pdfOk,
  };
}

/**
 * @param {object} ot
 * @param {ReturnType<typeof computeCopilotOperationalTrace>} trace
 */
export function describeProcessGap(ot, trace) {
  const st = String(ot?.estado || '').toLowerCase();
  const enEjecucion = ['en proceso', 'proceso', 'visita', 'ejecucion', 'ejecución'].some((k) =>
    st.includes(k)
  );
  if (enEjecucion && !trace.hasTech) {
    return 'Hay ejecución declarada sin técnico asignado: conviene cerrar Asignación en Clima antes de seguir.';
  }
  if (trace.activeIdx === 1 && !trace.hasTipo) {
    return 'Esta solicitud debería pasar por Clasificación (tipo/subtipo) antes de avanzar a Ejecución.';
  }
  if (trace.activeIdx === 2) {
    return 'El flujo está en Asignación: asigná técnico antes de presionar visita o cierre de etapa.';
  }
  if (trace.activeIdx === 3 && !trace.gaps0) {
    return 'Falta evidencia de terreno completa; sin eso el informe para cierre correcto queda bloqueado.';
  }
  if (trace.activeIdx === 4 && !trace.pdfOk) {
    return 'Falta informe PDF para un cierre ordenado; generalo desde Clima cuando la evidencia esté lista.';
  }
  return null;
}
