/**
 * HNF Intelligence Base V1 — capa estructurada de reglas operativas para Jarvis.
 * Proveedores extensibles; sin reemplazar flujos existentes de OT / Ingreso / trazas.
 */

import { buildOperationalControlSnapshot } from './operational-control-rules.js';
import { buildTimingAlerts } from './timing-rules.js';
import { listOtFlowGaps } from './ot-flow-rules.js';
import { buildClimateApprovalBoard, answerClimateApprovalQuery } from './climate-approval-intelligence.js';
import { inferActiveRole, rolePreamble, ROLE_FOCUS, HNF_ROLES } from './role-logic.js';
import { buildHnfStyleRecommendations } from './recommendations.js';
import { buildAutomationHintsForOt } from './automation-rules.js';
import { getStoredOperatorName } from '../../config/operator.config.js';

export const HNF_INTELLIGENCE_BASE_VERSION = '2026-03-27-v1';

export { NAMED_FIELD_RESOURCES, suggestAssignmentForOt } from './assignment-rules.js';
export { resolveOperationalPriority } from './priority-rules.js';
export { HNF_CLIENT_POLICIES, resolveClientPolicy, clientPolicyRecommendations } from './client-rules.js';
export { listOtFlowGaps, HNF_OT_FLOW_CHAIN } from './ot-flow-rules.js';
export { buildTimingAlerts, THRESHOLDS } from './timing-rules.js';
export { buildOperationalControlSnapshot } from './operational-control-rules.js';
export {
  buildClimateApprovalBoard,
  classifyClimateApprovalEmail,
  CLIMATE_APPROVAL_STATE,
  answerClimateApprovalQuery,
} from './climate-approval-intelligence.js';
export { inferActiveRole, rolePreamble, HNF_ROLES, ROLE_FOCUS } from './role-logic.js';
export { buildAutomationHintsForOt } from './automation-rules.js';

function planOtsFrom(data) {
  const ots = data?.planOts ?? data?.ots?.data ?? [];
  return Array.isArray(ots) ? ots : [];
}

/**
 * Snapshot completo para paneles, copiloto y futuros motores IA.
 */
export function buildHnfIntelligenceBaseV1Snapshot(viewData = {}, controlCards = []) {
  const ots = planOtsFrom(viewData);
  const abiertas = ots.filter((o) => {
    const st = String(o?.estado || '').toLowerCase();
    return st && !['terminado', 'cerrada', 'cerrado', 'cancelado'].includes(st);
  });
  const sampleOt = abiertas[0] || null;

  const operationalControl = buildOperationalControlSnapshot(ots);
  const timingAlerts = buildTimingAlerts(ots);
  const flowGaps = listOtFlowGaps(ots, controlCards);
  const climateBoard = buildClimateApprovalBoard(viewData);

  const roleKey = inferActiveRole(getStoredOperatorName());

  const knowledgeProviders = [
    { id: 'assignment_v1', version: '2026-03-27' },
    { id: 'priority_v1', version: '2026-03-27' },
    { id: 'client_policy_v1', version: '2026-03-27' },
    { id: 'ot_flow_v1', version: '2026-03-27' },
    { id: 'timing_v1', version: '2026-03-27' },
    { id: 'operational_control_v1', version: '2026-03-27' },
    { id: 'climate_approval_v1', version: '2026-03-27' },
    { id: 'role_logic_v1', version: '2026-03-27' },
    { id: 'automation_v1', version: '2026-03-27' },
  ];

  const snapshot = {
    version: HNF_INTELLIGENCE_BASE_VERSION,
    computedAt: new Date().toISOString(),
    roleKey,
    rolePreamble: rolePreamble(roleKey),
    roleCard: ROLE_FOCUS[roleKey] || ROLE_FOCUS[HNF_ROLES.JARVIS],
    knowledgeProviders,
    operationalControl,
    timingAlerts,
    flowGaps,
    climateBoard,
    sampleOt,
  };

  snapshot.recommendations = buildHnfStyleRecommendations(snapshot);
  snapshot.automationSample = sampleOt ? buildAutomationHintsForOt(sampleOt) : null;

  return snapshot;
}

/**
 * Consultas naturales dirigidas a la base v1 (aprobaciones, flujo, reglas).
 */
export function queryHnfIntelligenceBaseV1(userText, viewData, controlCards = []) {
  const q = String(userText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();

  const snap = buildHnfIntelligenceBaseV1Snapshot(viewData, controlCards);

  const climateAns = answerClimateApprovalQuery(q, snap.climateBoard);
  if (climateAns) {
    return {
      intent: 'intelligence_climate_approval',
      datos: `${snap.rolePreamble}\n\n${climateAns.datos}`,
      accionSugerida: climateAns.accionSugerida,
      mejoraSugerida: climateAns.mejoraSugerida,
      snapshot: snap,
    };
  }

  if (
    q.includes('flujo') ||
    q.includes('paso') ||
    q.includes('clasificacion') ||
    q.includes('trazabilidad')
  ) {
    const n = snap.flowGaps.length;
    return {
      intent: 'intelligence_ot_flow',
      datos: `${snap.rolePreamble}\n\n${n} OT con huecos de flujo (Solicitud → … → Cierre). ${
        snap.flowGaps[0] ? `Ej.: OT ${snap.flowGaps[0].otId} — ${snap.flowGaps[0].gap}` : ''
      }`,
      accionSugerida:
        n > 0
          ? 'Corregir etapa en Clima antes de forzar visita o cierre.'
          : 'Sin huecos detectados por reglas v1 en el corte actual.',
      mejoraSugerida: 'Documentar origen y subtipo en ingreso para reducir saltos de etapa.',
      snapshot: snap,
    };
  }

  if (q.includes('tiempo') || q.includes('demora') || q.includes('atrasad') || q.includes('vencid')) {
    const a = snap.timingAlerts.alerts;
    return {
      intent: 'intelligence_timing',
      datos: `${snap.rolePreamble}\n\n${a.length ? a.map((x) => x.text).join(' ') : 'Sin alertas de tiempo fuera de umbral en v1.'}`,
      accionSugerida:
        a.length > 0 ? 'Priorizar OT listadas y actualizar asignación o estado en panel.' : 'Mantener monitoreo semanal.',
      mejoraSugerida: 'Calibrar umbrales por línea de negocio y por cliente clave.',
      snapshot: snap,
    };
  }

  if (q.includes('regla') || q.includes('inteligencia hnf') || q.includes('prioridad operativa')) {
    const r = snap.recommendations[0];
    return {
      intent: 'intelligence_summary',
      datos: `${snap.rolePreamble}\n\nResumen control: ${snap.operationalControl.totalAbiertas} OT abiertas; ${snap.operationalControl.sinTecnico} sin técnico; ${snap.operationalControl.urgentes} con texto de urgencia; ${snap.operationalControl.sinInformePdfOEvidencia} con informe/evidencia pendiente.`,
      accionSugerida: r?.accionSugerida || 'Revisar panel operativo en vivo.',
      mejoraSugerida: r?.mejoraSugerida || 'Conectar más señales de calendario y correo en v2.',
      snapshot: snap,
    };
  }

  return null;
}
