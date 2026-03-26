/**
 * HNF Jarvis Core — consolida motores existentes (Intel, Flow, documentos, comercial, calendario, Autopilot).
 * No redefine reglas de negocio: solo ensambla, prioriza y explica.
 */

import { otCanClose } from '../utils/ot-evidence.js';
import {
  getDirectorOperationalBrief,
  getOperationalHealthState,
  monthRangeYmd,
} from './hnf-intelligence-engine.js';
import {
  computeCommercialOpportunityAlerts,
  computeCommercialOpportunitySummary,
  computeTechnicalDocumentAlerts,
} from './technical-document-intelligence.js';
import {
  classifyAutopilotActions,
  getAutopilotMetrics,
  getLastAutopilotCycle,
  listPendingApprovals,
} from './hnf-autopilot.js';
import { getAutopilotMemorySummary, getDocumentApprovalMemorySummary } from './hnf-memory.js';
import {
  aggregateOutlookPendingByOwner,
  buildOutlookFollowUpSignals,
  computeInternalDelayAlerts,
} from './outlook-intelligence.js';
import {
  computeJarvisAutonomicEnvelope,
  runJarvisAutonomicCycle as runJarvisMAPECycle,
} from './jarvis-autonomic-engine.js';
import {
  applyJarvisDataToggles,
  getControlState,
  loadJarvisFrozenUnifiedSnapshot,
  saveJarvisFrozenUnifiedSnapshot,
} from './jarvis-control-center.js';
import {
  buildJarvisCurrentIngestion,
  computeJarvisSustainabilityMetrics,
} from './jarvis-live-ingestion.js';
import { buildJarvisFlowIntelligence } from './jarvis-flow-intelligence.js';
import { buildJarvisAtom } from './jarvis-atomic-core.js';
import { runJarvisSelfHealing } from './jarvis-self-healing.js';
import { runJarvisEvolutionEngine } from './jarvis-evolution-engine.js';
import { buildJarvisCommercialIntelAdvanced } from './jarvis-commercial-intel-advanced.js';
import { detectJarvisBusinessErrors } from './jarvis-business-errors.js';
import { jarvisRuntimeGetSnapshot } from './jarvis-runtime-snapshot.js';
import { buildJarvisAlienCore } from './jarvis-alien-core-engine.js';
import { buildJarvisFrictionPressure } from './jarvis-friction-pressure-engine.js';
import { buildJarvisLiveBrain } from './jarvis-live-brain-engine.js';
import { buildJarvisOperador, buildJarvisOperatorViewModel } from './jarvis-operador-engine.js';
import { buildJarvisCerebroOperativo } from './jarvis-cerebro-operativo-engine.js';
import { buildJarvisMemoriaEvolutiva } from './jarvis-memoria-evolutiva-engine.js';
import { buildJarvisExpansionRadar } from './jarvis-expansion-radar.js';
import { buildAlienDecisionCore } from './jarvis-alien-intelligence.js';
import { buildJarvisPresence, buildJarvisStartupSequence } from './jarvis-presence-engine.js';
import { buildJarvisSoul } from './jarvis-soul-engine.js';
import {
  buildDirectorBriefForHernan,
  buildDirectorBriefForLyn,
  buildExecutiveResponse,
  buildJarvisDataRequests,
  buildLiveInboundDigest,
} from './jarvis-voice-engine.js';

export { buildJarvisCurrentIngestion, computeJarvisSustainabilityMetrics };

export const JARVIS_CORE_VERSION = '2026-03-23';

const sortJarvisOperativeEvents = (raw) => {
  const ev = Array.isArray(raw?.jarvisOperativeEvents) ? raw.jarvisOperativeEvents : [];
  const m = new Map();
  for (const e of ev) {
    if (e?.id) m.set(e.id, e);
  }
  return [...m.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
};

function attachJarvisEnterpriseIntelligence(result, viewData) {
  if (!result || typeof result !== 'object') return;
  const rt = jarvisRuntimeGetSnapshot();
  result.jarvisAtom = buildJarvisAtom(result, rt, viewData);
  result.jarvisSelfHealing = runJarvisSelfHealing(result, viewData, rt);
  result.jarvisEvolution = runJarvisEvolutionEngine(result, rt);
  result.jarvisCommercialIntelAdvanced = buildJarvisCommercialIntelAdvanced(result);
  result.jarvisBusinessErrors = detectJarvisBusinessErrors(result);
}

const pad2 = (n) => String(n).padStart(2, '0');

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const mondayOf = (d) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
};

const addDays = (d, delta) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const economicsOk = (ot) => roundMoney(ot?.montoCobrado) > 0 && roundMoney(ot?.costoTotal) > 0;

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const diasDesde = (isoOrYmd) => {
  const t = parseTs(isoOrYmd);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
};

const mergeSemaforo = (healthFromIssues, risks) => {
  const altas = (risks || []).filter((r) => r.criticidad === 'alta').length;
  if (healthFromIssues === 'critico' || altas >= 4) return 'critico';
  if (healthFromIssues === 'atencion' || altas >= 1) return 'atencion';
  return 'optimo';
};

const estadoGeneralLabel = (key) => {
  if (key === 'critico') return 'Crítico — requiere intervención directiva hoy';
  if (key === 'atencion') return 'Atención — priorizar desbloqueos y cierres';
  return 'Operativo — mantener ritmo y seguimiento comercial';
};

function planOtsFrom(viewData) {
  const vd = viewData || {};
  return vd.planOts ?? vd.ots?.data ?? (Array.isArray(vd.ots) ? vd.ots : []);
}

function normalizeOutlookFeed(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  const hooks =
    f.futureOutlookHooks && typeof f.futureOutlookHooks === 'object' ? f.futureOutlookHooks : {};
  return {
    version: f.version || '2026-03-23',
    messages: Array.isArray(f.messages) ? f.messages : [],
    historicalImports: Array.isArray(f.historicalImports) ? f.historicalImports : [],
    ingestErrors: Array.isArray(f.ingestErrors) ? f.ingestErrors : [],
    lastIngestAt: f.lastIngestAt || null,
    outlookIntakeMode: f.outlookIntakeMode || 'recepcion_solo_lectura',
    futureOutlookHooks: {
      ...hooks,
      inboxSync: false,
      replyDraft: false,
      threadSync: false,
      sendMail: false,
      autoReply: false,
      outboundSync: false,
      note:
        hooks.note ||
        'MODO RECEPCIÓN — solo lectura e ingesta; sin envío, auto-respuesta ni sincronización de salida.',
    },
  };
}

/**
 * Base unificada sin motor MAPE (sensores + Intel). Usada por getJarvisUnifiedState y runJarvisAutonomicCycle.
 * @param {object} viewData - Misma forma que loadFullOperationalData (main.js).
 */
export function assembleJarvisUnifiedBase(viewData = {}) {
  const vd = viewData || {};
  const intelBrief = getDirectorOperationalBrief(vd);
  const planOts = planOtsFrom(vd);
  const docs = Array.isArray(vd.technicalDocuments) ? vd.technicalDocuments : [];
  const docAlerts =
    Array.isArray(vd.technicalDocumentAlerts) && vd.technicalDocumentAlerts.length
      ? vd.technicalDocumentAlerts
      : computeTechnicalDocumentAlerts(docs, planOts);
  const opps = Array.isArray(vd.commercialOpportunities) ? vd.commercialOpportunities : [];
  const commAlerts =
    Array.isArray(vd.commercialOpportunityAlerts) && vd.commercialOpportunityAlerts.length
      ? vd.commercialOpportunityAlerts
      : computeCommercialOpportunityAlerts(opps);
  const calAlerts = Array.isArray(vd.operationalCalendarAlerts) ? vd.operationalCalendarAlerts : [];
  const { start, end } = monthRangeYmd();
  const commercialSummary = computeCommercialOpportunitySummary(opps, start, end);

  const autopilotClassified = classifyAutopilotActions(intelBrief, vd);
  const autopilotPending = listPendingApprovals();
  const autopilotMetrics = getAutopilotMetrics();
  const autopilotLastCycle = getLastAutopilotCycle();

  const outlookFeed = normalizeOutlookFeed(vd.outlookFeed);
  const outlookContext = { technicalDocuments: docs, planOts };
  const followPack = buildOutlookFollowUpSignals(outlookFeed, outlookContext);
  const delayPack = computeInternalDelayAlerts(outlookFeed, outlookContext);
  const pendingByOwner = aggregateOutlookPendingByOwner(outlookFeed);

  const historicalVaultRaw =
    vd.historicalVault && typeof vd.historicalVault === 'object' ? vd.historicalVault : null;
  const historicalVaultSummary = historicalVaultRaw?.computed?.summary ?? null;
  const historicalPatterns = historicalVaultRaw?.computed?.patterns ?? [];
  const historicalAlerts = historicalVaultRaw?.computed?.historicalAlerts ?? [];
  const historicalSearchIndex = historicalVaultRaw?.computed?.historicalSearchIndex ?? null;
  const monthArchiveStatus = historicalVaultRaw?.computed?.monthArchiveStatus ?? {};

  return {
    version: JARVIS_CORE_VERSION,
    computedAt: new Date().toISOString(),
    intelBrief,
    technicalDocumentAlerts: docAlerts,
    commercialOpportunityAlerts: commAlerts,
    commercialSummary,
    operationalCalendarAlerts: calAlerts,
    whatsappFeed: vd.whatsappFeed ?? null,
    technicalDocuments: docs,
    commercialOpportunities: opps,
    operationalCalendar: vd.operationalCalendar || { entries: [] },
    planOts,
    planMantenciones: Array.isArray(vd.planMantenciones) ? vd.planMantenciones : [],
    autopilot: {
      classified: autopilotClassified,
      pendingApprovals: autopilotPending,
      metrics: autopilotMetrics,
      lastCycle: autopilotLastCycle,
    },
    memoryHints: {
      autopilotMemory: getAutopilotMemorySummary(),
      documentApprovalMemory: getDocumentApprovalMemorySummary(),
    },
    outlookFeed,
    outlookFollowUp: {
      signals: followPack.signals || [],
      delayAlerts: delayPack.alerts || [],
      pendingByOwner,
      historicalImports: outlookFeed.historicalImports || [],
    },
    historicalVault: historicalVaultRaw || { records: [], importBatches: [], computed: null },
    historicalVaultSummary,
    historicalPatterns,
    historicalAlerts,
    historicalSearchIndex,
    monthArchiveStatus,
  };
}

/**
 * @param {object} viewData - Misma forma que loadFullOperationalData (main.js).
 */
export function getJarvisUnifiedState(viewData = {}) {
  const raw = viewData || {};
  const ctrl = getControlState();
  const jarvisOperativeEventsSorted = sortJarvisOperativeEvents(raw);
  const liveIngestion = buildJarvisCurrentIngestion({
    ...raw,
    jarvisOperativeEvents: jarvisOperativeEventsSorted,
  });
  const toggledVd = applyJarvisDataToggles(raw, ctrl.jarvisToggles);

  if (ctrl.jarvisMode === 'off') {
    const frozen = loadJarvisFrozenUnifiedSnapshot();
    if (frozen && typeof frozen === 'object') {
      const frozenMerged = {
        ...frozen,
        computedAt: new Date().toISOString(),
        jarvisControl: ctrl,
        jarvisExecutionLevel: 'off',
        jarvisFrozen: true,
        liveIngestion,
        sustainability: {},
      };
      frozenMerged.sustainability = computeJarvisSustainabilityMetrics(
        { ...frozen, systemHealth: frozen.systemHealth },
        liveIngestion,
        ctrl
      );
      frozenMerged.jarvisFlowIntelligence = buildJarvisFlowIntelligence(frozenMerged);
      attachJarvisEnterpriseIntelligence(frozenMerged, raw);
      frozenMerged.jarvisOperador = buildJarvisOperador(frozenMerged);
      frozenMerged.jarvisOperator = buildJarvisOperatorViewModel(
        frozenMerged.jarvisOperador,
        frozenMerged.jarvisFlowIntelligence,
        { jarvisExecutionLevel: 'off' }
      );
      frozenMerged.jarvisEvolution = runJarvisEvolutionEngine(frozenMerged, jarvisRuntimeGetSnapshot());
      frozenMerged.jarvisFrictionPressure = buildJarvisFrictionPressure(frozenMerged);
      frozenMerged.jarvisExpansionRadar = buildJarvisExpansionRadar(frozenMerged);
      frozenMerged.jarvisAlienCore = buildJarvisAlienCore(frozenMerged);
      frozenMerged.jarvisLiveBrain = buildJarvisLiveBrain(frozenMerged);
      frozenMerged.jarvisAlienDecisionCore = buildAlienDecisionCore(frozenMerged);
      frozenMerged.jarvisSoul = buildJarvisSoul(frozenMerged);
      frozenMerged.jarvisOperativeEvents = jarvisOperativeEventsSorted;
      frozenMerged.jarvisOperativeBrief = {
        last: jarvisOperativeEventsSorted[0] || null,
        count: jarvisOperativeEventsSorted.length,
      };
      frozenMerged.jarvisPresence = buildJarvisPresence(frozenMerged);
      frozenMerged.jarvisStartupSequence = buildJarvisStartupSequence(frozenMerged);
      frozenMerged.jarvisExecutiveVoice = buildExecutiveResponse(frozenMerged);
      frozenMerged.jarvisDirectorBriefHernan = buildDirectorBriefForHernan(frozenMerged);
      frozenMerged.jarvisDirectorBriefLyn = buildDirectorBriefForLyn(frozenMerged);
      frozenMerged.jarvisDataRequests = buildJarvisDataRequests(frozenMerged);
      frozenMerged.jarvisLiveInboundDigest = buildLiveInboundDigest(frozenMerged);
      frozenMerged.jarvisCerebroOperativo = buildJarvisCerebroOperativo(frozenMerged);
      frozenMerged.jarvisMemoriaEvolutiva = buildJarvisMemoriaEvolutiva(frozenMerged);
      return frozenMerged;
    }
  }

  const base = assembleJarvisUnifiedBase(toggledVd);
  let autonomic;
  if (ctrl.jarvisMode === 'off') {
    autonomic = {
      version: 'off',
      phase: 'off',
      selfReport:
        'Modo apagado sin snapshot previo: se muestra análisis mínimo. Activá otro modo y recalculá para congelar estado.',
      systemHealth: 0,
      riskLevel: 'low',
      opportunityScore: 0,
      efficiencyScore: 0,
      plan: { buckets: {} },
      execute: { alerts: [], tasks: [], priorities: [], navigationHints: [] },
      internalFailures: [],
      improvements: [],
      monitor: null,
      analysis: { findings: [] },
    };
  } else {
    autonomic = computeJarvisAutonomicEnvelope(base);
  }

  const result = {
    ...base,
    autonomicState: autonomic,
    systemHealth: autonomic.systemHealth,
    riskLevel: autonomic.riskLevel,
    opportunityScore: autonomic.opportunityScore,
    efficiencyScore: autonomic.efficiencyScore,
    jarvisControl: ctrl,
    jarvisExecutionLevel: ctrl.jarvisMode,
    liveIngestion,
    sustainability: {},
  };
  result.sustainability = computeJarvisSustainabilityMetrics(result, liveIngestion, ctrl);
  result.jarvisFlowIntelligence = buildJarvisFlowIntelligence(result);
  attachJarvisEnterpriseIntelligence(result, raw);
  result.jarvisOperador = buildJarvisOperador(result);
  result.jarvisOperator = buildJarvisOperatorViewModel(result.jarvisOperador, result.jarvisFlowIntelligence, {
    jarvisExecutionLevel: result.jarvisExecutionLevel,
  });
  result.jarvisEvolution = runJarvisEvolutionEngine(result, jarvisRuntimeGetSnapshot());
  result.jarvisFrictionPressure = buildJarvisFrictionPressure(result);
  result.jarvisExpansionRadar = buildJarvisExpansionRadar(result);
  result.jarvisAlienCore = buildJarvisAlienCore(result);
  result.jarvisLiveBrain = buildJarvisLiveBrain(result);
  result.jarvisAlienDecisionCore = buildAlienDecisionCore(result);
  result.jarvisSoul = buildJarvisSoul(result);
  result.jarvisOperativeEvents = jarvisOperativeEventsSorted;
  result.jarvisOperativeBrief = {
    last: jarvisOperativeEventsSorted[0] || null,
    count: jarvisOperativeEventsSorted.length,
  };
  result.jarvisPresence = buildJarvisPresence(result);
  result.jarvisStartupSequence = buildJarvisStartupSequence(result);
  result.jarvisExecutiveVoice = buildExecutiveResponse(result);
  result.jarvisDirectorBriefHernan = buildDirectorBriefForHernan(result);
  result.jarvisDirectorBriefLyn = buildDirectorBriefForLyn(result);
  result.jarvisDataRequests = buildJarvisDataRequests(result);
  result.jarvisLiveInboundDigest = buildLiveInboundDigest(result);
  result.jarvisCerebroOperativo = buildJarvisCerebroOperativo(result);
  result.jarvisMemoriaEvolutiva = buildJarvisMemoriaEvolutiva(result);

  if (ctrl.jarvisMode !== 'off') {
    saveJarvisFrozenUnifiedSnapshot(result);
  }

  return result;
}

/**
 * MAPE completo; persistencia según toggle persistMapeMemory o options.persistMemory.
 * @param {object} viewData - datos de vista / operación
 * @param {object} [options] - { persistMemory?: boolean }
 */
export function runJarvisAutonomicCycle(viewData, options = {}) {
  const ctrl = getControlState();
  if (ctrl.jarvisMode === 'off') {
    return { skipped: true, reason: 'jarvis_mode_off', version: JARVIS_CORE_VERSION };
  }
  const toggled = applyJarvisDataToggles(viewData || {}, ctrl.jarvisToggles);
  const persist =
    options.persistMemory === true ||
    (options.persistMemory !== false && ctrl.jarvisToggles.persistMapeMemory === true);
  return runJarvisMAPECycle(assembleJarvisUnifiedBase(toggled), { persistMemory: persist });
}

function docNav(docId) {
  return docId ? { view: 'technical-documents', documentoId: docId } : { view: 'technical-documents' };
}

function intelItemToBucket(item) {
  const c = item.codigo || '';
  if (c === 'CLIM_SIN_COBRO') return 'cobrar_hoy';
  if (c === 'CLIM_SIN_PDF' || c === 'DOC_OT_SIN_INFORME') return 'revisar_hoy';
  if (String(item.tipo || '').toUpperCase() === 'SEGUIMIENTO') return 'seguimiento';
  if (c.startsWith('OP_') || item.modulo === 'oportunidades') return 'vender_hoy';
  if (item.modulo === 'technical-documents' || c.startsWith('DOC_')) return 'revisar_hoy';
  return 'ejecutar_hoy';
}

function priorityNum(tipo, codigo) {
  if (tipo === 'CRITICO' || codigo === 'CLIM_SIN_COBRO') return 1;
  if (tipo === 'ATENCION') return 2;
  return 3;
}

let actSeq = 0;
const nextActId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(actSeq += 1)}`;

/**
 * @param {ReturnType<typeof getJarvisUnifiedState>} unified
 */
export function buildJarvisActionBoard(unified) {
  const u = unified || {};
  const brief = u.intelBrief || getDirectorOperationalBrief({});
  const execQ = brief.executionQueue || [];
  const decision = brief.flow?.decision || {};
  const planOts = u.planOts || [];
  const docs = u.technicalDocuments || [];

  /** @type {Record<string, object[]>} */
  const buckets = {
    ejecutar_hoy: [],
    revisar_hoy: [],
    aprobar_hoy: [],
    cobrar_hoy: [],
    vender_hoy: [],
    seguimiento: [],
  };

  const seen = new Set();

  const pushAct = (bucket, row) => {
    const k = `${row.modulo}:${row.titulo}:${row.codigo || ''}`;
    if (seen.has(k)) return;
    seen.add(k);
    buckets[bucket].push(row);
  };

  for (const it of execQ) {
    const bucket = intelItemToBucket(it);
    pushAct(bucket, {
      id: nextActId('jq'),
      titulo: it.titulo || it.accionCorta || it.codigo,
      modulo: it.modulo || 'intel',
      prioridad: priorityNum(it.tipo, it.codigo),
      motivo: it.descripcion || it.accionCorta || 'Cola Intel (buildIntelExecutionQueue)',
      nav: it.nav || null,
      requiereAprobacion: false,
      origen: 'intel_execution_queue',
      impactoEsperado: it.tipo === 'CRITICO' ? 'Cierre económico / cobro / cumplimiento' : 'Orden operativo y riesgo contenido',
      codigo: it.codigo,
      tipo: it.tipo,
    });
  }

  for (const a of decision.accionesPrioritarias || []) {
    const cod = a.codigo || '';
    let bucket = 'ejecutar_hoy';
    if (cod === 'CLIM_SIN_COBRO') bucket = 'cobrar_hoy';
    else if (cod === 'CLIM_SIN_PDF') bucket = 'revisar_hoy';
    pushAct(bucket, {
      id: nextActId('fl'),
      titulo: a.titulo || cod,
      modulo: a.modulo || 'flow_control',
      prioridad: a.prioridad ?? 2,
      motivo: a.detalle || 'Flow Control (decideNextActions)',
      nav: a.nav || null,
      requiereAprobacion: false,
      origen: 'flow_control',
      impactoEsperado: 'Alineación de eventos y riesgos operativos',
      codigo: cod,
    });
  }

  for (const d of docs) {
    const st = d.estadoDocumento;
    const id = d.id;
    if (st === 'en_revision') {
      pushAct('revisar_hoy', {
        id: nextActId('doc'),
        titulo: `Revisar documento ${id}`,
        modulo: 'technical-documents',
        prioridad: 2,
        motivo: d.tituloDocumento || d.cliente || 'En revisión Lyn',
        nav: docNav(id),
        requiereAprobacion: false,
        origen: 'technical_documents',
        impactoEsperado: 'Aprobación y envío al cliente',
      });
    }
    if (st === 'observado') {
      pushAct('revisar_hoy', {
        id: nextActId('doc'),
        titulo: `Corregir observado ${id}`,
        modulo: 'technical-documents',
        prioridad: 1,
        motivo: d.cliente || 'Documento observado',
        nav: docNav(id),
        requiereAprobacion: false,
        origen: 'technical_documents',
        impactoEsperado: 'Desbloqueo del circuito documental',
      });
    }
    if (st === 'aprobado' && !d.enviadoClienteEn) {
      pushAct('ejecutar_hoy', {
        id: nextActId('doc'),
        titulo: `Enviar al cliente · ${id}`,
        modulo: 'technical-documents',
        prioridad: 2,
        motivo: 'Aprobado sin marca de envío',
        nav: docNav(id),
        requiereAprobacion: false,
        origen: 'technical_documents',
        impactoEsperado: 'Cierre percibido por el cliente',
      });
    }
  }

  for (const o of u.commercialOpportunities || []) {
    if (String(o.prioridad) === 'alta' && String(o.estado) === 'pendiente') {
      pushAct('vender_hoy', {
        id: nextActId('op'),
        titulo: `Oportunidad urgente · ${o.cliente || o.id}`,
        modulo: 'oportunidades',
        prioridad: 1,
        motivo: o.descripcion || 'Alta prioridad pendiente de gestión',
        nav: { view: 'oportunidades' },
        requiereAprobacion: false,
        origen: 'commercial_opportunities',
        impactoEsperado: `Potencial ~$${Math.round(Number(o.estimacionMonto || 0)).toLocaleString('es-CL')}`,
      });
    }
  }

  for (const p of u.autopilot?.pendingApprovals || []) {
    pushAct('aprobar_hoy', {
      id: nextActId('ap'),
      titulo: p.accion || 'Aprobación Autopilot',
      modulo: p.modulo || 'autopilot',
      prioridad: 1,
      motivo: p.motivo || p.descripcion || 'Pendiente de aprobación humana',
      nav: p.nav || { view: 'operacion-control' },
      requiereAprobacion: true,
      origen: 'hnf_autopilot',
      impactoEsperado: p.impacto || 'Ejecución asistida tras validación',
      queueRefId: p.queueRefId,
      actionId: p.id,
    });
  }

  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => (a.prioridad || 9) - (b.prioridad || 9));
  }

  return { version: JARVIS_CORE_VERSION, computedAt: new Date().toISOString(), buckets };
}

/**
 * @param {ReturnType<typeof getJarvisUnifiedState>} unified
 */
export function buildJarvisDailyBrief(unified) {
  const u = unified || getJarvisUnifiedState({});
  const { snapshot, issues, executionQueue, flow } = u.intelBrief;
  const health = getOperationalHealthState(issues);
  const sem = mergeSemaforo(health, flow.risks);
  const decision = flow.decision || {};
  const planOts = u.planOts || [];
  const otsClima = planOts.filter(isOtClima);
  const today = todayYmd();
  const weekStart = addDays(mondayOf(new Date()), 0);
  const weekEnd = addDays(mondayOf(new Date()), 6);

  const docs = u.technicalDocuments || [];
  const porRevisar = docs.filter((d) => d.estadoDocumento === 'en_revision').length;
  const observados = docs.filter((d) => d.estadoDocumento === 'observado').length;
  const aprobadosNoEnviados = docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn).length;

  const entries = Array.isArray(u.operationalCalendar?.entries) ? u.operationalCalendar.entries : [];
  const visitasHoy = entries.filter((e) => String(e.fecha || '').slice(0, 10) === today).length;
  const sobrecargaTecnica = u.operationalCalendarAlerts.filter((a) => a.code === 'CAL_TEC_SOBRECARGA').length;
  const continuidadPendiente = u.operationalCalendarAlerts.filter((a) =>
    ['CAL_SIN_OT', 'CAL_OT_TERM_SIN_EJEC'].includes(a.code)
  ).length;

  const otAbiertas = otsClima.filter((o) => o.estado !== 'terminado').length;
  const otPorCerrar = otsClima.filter((o) => o.estado !== 'terminado' && economicsOk(o) && otCanClose(o)).length;
  const otAbiertasLargas = otsClima.filter((o) => {
    if (o.estado === 'terminado') return false;
    const d = diasDesde(o.creadoEn || o.createdAt || o.fecha);
    return d != null && d > 7;
  }).length;

  const mantencionesSemana = (u.planMantenciones || []).filter((m) => {
    const f = String(m.fecha || m.fechaProgramada || '').slice(0, 10);
    return f >= weekStart && f <= weekEnd;
  }).length;

  const sum = u.commercialSummary || {};
  const critQueue = executionQueue.filter((i) => i.tipo === 'CRITICO').slice(0, 8);
  const prioridadesCriticas = critQueue.map((i) => ({
    titulo: i.titulo,
    codigo: i.codigo,
    modulo: i.modulo,
    nav: i.nav,
  }));

  const accionesHoy = (decision.accionesPrioritarias || []).slice(0, 10).map((a) => ({
    titulo: a.titulo,
    codigo: a.codigo,
    modulo: a.modulo,
    nav: a.nav,
  }));

  const bloqueos = (decision.bloqueos || []).map((b) => ({
    texto: b.texto,
    code: b.code,
    fuente: b.fuente,
  }));

  const riesgos = (flow.risks || [])
    .filter((r) => r.criticidad === 'alta' || r.criticidad === 'media')
    .slice(0, 12)
    .map((r) => ({
      code: r.code,
      mensaje: r.mensaje,
      criticidad: r.criticidad,
      modulo: r.modulo,
    }));

  const ofeed = u.outlookFeed || { messages: [], historicalImports: [], lastIngestAt: null };
  const omsgs = ofeed.messages || [];
  const ofu = u.outlookFollowUp || { delayAlerts: [], signals: [], pendingByOwner: {} };
  const delayAlerts = ofu.delayAlerts || [];
  const reporteHL = delayAlerts.filter((a) => a.reportarAHernan || a.reportarALyn);
  const permisosDetenidos = delayAlerts.filter((a) => a.code === 'OUT_PERMISO_PROG').length;
  const todayIso = today;
  const absorbHoy = (ofeed.historicalImports || []).filter((im) =>
    String(im.processedAt || '').slice(0, 10) === todayIso
  ).length;

  const hvSum = u.historicalVaultSummary || {};
  const hvPat = (u.historicalPatterns || []).length;
  const hvAlt = (u.historicalAlerts || []).length;

  const topPotencialClientes = (() => {
    const m = new Map();
    for (const o of u.commercialOpportunities || []) {
      if (!['pendiente', 'cotizado'].includes(String(o.estado))) continue;
      const c = String(o.cliente || '—').trim() || '—';
      m.set(c, (m.get(c) || 0) + Number(o.estimacionMonto || 0));
    }
    return [...m.entries()]
      .filter(([c]) => c !== '—')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cliente, monto]) => ({ cliente, montoPotencial: Math.round(monto * 100) / 100 }));
  })();

  const live = u.liveIngestion;
  const liveExtra =
    live?.currentSignals?.length && Array.isArray(live.currentSignals)
      ? ` Ingesta viva: ${live.currentSignals.slice(0, 3).join(' — ')}.`
      : '';

  const resumenEjecutivo = [
    `${estadoGeneralLabel(sem)} · OT Clima abiertas: ${otAbiertas}, flota en ruta: ${snapshot.flota?.enRuta ?? 0}.`,
    `Documentos: ${porRevisar} en revisión, ${observados} observados, ${aprobadosNoEnviados} aprobados sin envío.`,
    `Comercial mes: ${sum.countMes ?? 0} oportunidades nuevas, potencial $${Math.round(sum.potencialTotalMes || 0).toLocaleString('es-CL')}, urgentes pendientes: ${sum.urgentesPendientesMes ?? 0}.`,
    `Outlook intake: ${omsgs.filter((m) => m.status === 'nuevo').length} correo(s) nuevo(s), ${delayAlerts.length} alerta(s) de demora interna, ${permisosDetenidos} permiso(s) con riesgo de programación; ingestas históricas hoy: ${absorbHoy}.`,
    `Historical Vault: ${hvSum.totalRecords ?? 0} registro(s) en archivo, ${hvPat} patrón(es) detectado(s), ${hvAlt} alerta(s) de memoria histórica${hvSum.lastImportAt ? `; última ingestión ${String(hvSum.lastImportAt).slice(0, 10)}` : ''}.`,
    liveExtra.trim(),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    fecha: today,
    estadoGeneral: estadoGeneralLabel(sem),
    resumenEjecutivo,
    prioridadesCriticas,
    accionesHoy,
    bloqueos,
    riesgos,
    comercial: {
      oportunidadesMes: sum.countMes ?? 0,
      urgentesPendientes: sum.urgentesPendientesMes ?? 0,
      montoPotencial: sum.potencialTotalMes ?? 0,
      topClientesPotencial: topPotencialClientes,
    },
    documentos: {
      porRevisar,
      observados,
      aprobadosNoEnviados,
    },
    operacion: {
      otAbiertas,
      otPorCerrar,
      otAbiertasMas7Dias: otAbiertasLargas,
      flotaEnRuta: snapshot.flota?.enRuta ?? 0,
      mantencionesSemana,
    },
    calendario: {
      visitasHoy,
      sobrecargaTecnica,
      continuidadPendiente,
    },
    outlook: {
      correosNuevos: omsgs.filter((m) => m.status === 'nuevo').length,
      enSeguimiento: omsgs.filter((m) => m.status === 'seguimiento').length,
      clasificados: omsgs.filter((m) => m.status === 'clasificado').length,
      permisosDetenidos,
      alertasDemora: delayAlerts.length,
      ultimaIngesta: ofeed.lastIngestAt,
      signals: (ofu.signals || []).slice(0, 6),
      reporteHernanLyn: reporteHL.slice(0, 12),
      pendientesRomina: (ofu.pendingByOwner?.Romina || []).length,
      pendientesGery: (ofu.pendingByOwner?.Gery || []).length,
      pendientesSinDueño: (ofu.pendingByOwner?.sin_dueño || []).length,
      historicosCargados: (ofeed.historicalImports || []).length,
      absorbidosHoy: absorbHoy,
    },
    historicalVault: {
      totalRecords: hvSum.totalRecords ?? 0,
      uniqueClients: hvSum.uniqueClients ?? 0,
      patternsCount: hvPat,
      alertsCount: hvAlt,
      lastImportAt: hvSum.lastImportAt ?? null,
      lastBatchName: hvSum.lastBatchName ?? null,
    },
    _meta: { semaforo: sem, health },
  };
}

/**
 * @param {object} input
 * @param {object} [input.queueItem] - ítem buildIntelExecutionQueue
 * @param {object} [input.action] - ítem action board
 * @param {object} [input.alert] - alerta ejecutiva o documental
 * @param {object} [input.issue] - issue detectOperationalIssues
 */
export function explainJarvisDecision(input) {
  const q = input?.queueItem;
  const a = input?.action;
  const al = input?.alert;
  const iss = input?.issue;

  if (q) {
    const cod = q.codigo || '—';
    const regla = `Motor Intelligence (código ${cod}): regla auditable sobre OT, flota o planificación.`;
    const critico = q.tipo === 'CRITICO' ? 'Afecta cierre, cobro o cumplimiento documental.' : 'Eleva riesgo operativo o retrasa ingreso.';
    const accion = q.accionCorta || 'Abrir el registro enlazado y completar el paso indicado.';
    const siNo = 'Si no se actúa, el pendiente sigue en snapshot y puede escalar en Flow Control o en brief comercial.';
    return `${critico} ${regla} Recomendación: ${accion} Consecuencia de omitir: ${siNo}`;
  }

  if (a) {
    return `Prioridad ${a.prioridad}: ${a.motivo}. Origen ${a.origen}. ${a.requiereAprobacion ? 'Requiere validación humana antes de efectuar cambios.' : 'Acción directa en el módulo indicado.'} Si se pospone, se mantiene el cuello de botella asociado.`;
  }

  if (al) {
    return `${al.title || al.mensaje || 'Alerta'}: severidad ${al.severity || al.criticidad || '—'}. Regla ${al.code || 'directiva Jarvis'}. ${al.recommendation || al.detalle || 'Revisar en el módulo enlazado.'} Sin acción, el riesgo se repite en futuros briefs.`;
  }

  if (iss) {
    return `${iss.mensaje} (${iss.code}). Tipo ${iss.tipo}. ${iss.accion || 'Ver módulo ' + (iss.modulo || '')}. Si no se corrige, el motor seguirá contabilizándolo en issues y cola ejecutable.`;
  }

  return 'Sin contexto suficiente: pasá queueItem, action, alert o issue en el input.';
}

/**
 * @param {ReturnType<typeof getJarvisMemorySummary>} memorySummary
 */
export function computeJarvisExecutiveAlerts(unified, memorySummary = null) {
  const u = unified || getJarvisUnifiedState({});
  const brief = u.intelBrief;
  const { snapshot, issues } = brief;
  const planOts = u.planOts || [];
  const otsClima = planOts.filter(isOtClima);
  const docs = u.technicalDocuments || [];
  const opps = u.commercialOpportunities || [];
  const alerts = [];

  const nav = (v, extra = {}) => ({ view: v, ...extra });

  const push = (row) => alerts.push({ ...row, nav: row.nav || null });

  const byClienteDoc = new Map();
  for (const d of docs) {
    const c = String(d.cliente || '—').trim() || '—';
    if (c === '—') continue;
    byClienteDoc.set(c, (byClienteDoc.get(c) || 0) + 1);
  }
  const byClienteComm = new Map();
  for (const o of opps) {
    const c = String(o.cliente || '—').trim() || '—';
    if (c === '—') continue;
    if (String(o.prioridad) === 'alta' && String(o.estado) === 'pendiente') {
      byClienteComm.set(c, (byClienteComm.get(c) || 0) + 1);
    }
  }
  for (const [c, n] of byClienteComm) {
    if (n >= 2) {
      push({
        code: 'JARVIS_CLI_MULTI_RIESGO_COM',
        severity: 'warning',
        title: `Cliente con varias oportunidades urgentes abiertas`,
        detail: `${c}: ${n} oportunidades alta/pendiente.`,
        recommendation: 'Concentrar gestión comercial y criterio de cierre en una sola visita llamada.',
        nav: nav('oportunidades'),
      });
    }
  }
  for (const [c, n] of byClienteDoc) {
    if (n >= 3) {
      const obs = docs.filter((d) => d.cliente === c && d.estadoDocumento === 'observado').length;
      if (obs >= 2) {
        push({
          code: 'JARVIS_OBS_REP_CLIENTE',
          severity: 'warning',
          title: 'Observaciones técnicas recurrentes en el mismo cliente',
          detail: `${c}: ${obs} documentos observados.`,
          recommendation: 'Revisión Lyn + checklist de calidad antes de nueva versión.',
          nav: nav('technical-documents'),
        });
      }
    }
  }

  const otLargas = otsClima.filter((o) => {
    if (o.estado === 'terminado') return false;
    const d = diasDesde(o.creadoEn || o.createdAt || o.fecha);
    return d != null && d > 7;
  }).length;
  if (otLargas >= 4) {
    push({
      code: 'JARVIS_OT_ABIERTA_7D_MAS',
      severity: 'warning',
      title: 'Volumen alto de OT abiertas más de 7 días',
      detail: `${otLargas} OT Clima superan el umbral del motor.`,
      recommendation: 'Priorizar cierre o reprogramación explícita en Clima.',
      nav: nav('clima'),
    });
  }

  const aprobNoEnv = docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn).length;
  if (aprobNoEnv > 0) {
    push({
      code: 'JARVIS_DOC_APROB_NO_ENV',
      severity: 'info',
      title: 'Informes aprobados sin envío al cliente',
      detail: `${aprobNoEnv} documento(s).`,
      recommendation: 'Marcar envío o adjuntar comprobante en módulo documental.',
      nav: nav('technical-documents'),
    });
  }

  let pushedOpUrg = false;
  for (const ca of u.commercialOpportunityAlerts || []) {
    if (ca.code === 'OP_URGENTE_SIN_GESTION' && !pushedOpUrg) {
      pushedOpUrg = true;
      push({
        code: 'JARVIS_OP_URG_SIN_GEST',
        severity: 'critical',
        title: 'Oportunidad urgente sin gestión',
        detail: ca.mensaje || ca.detalle,
        recommendation: 'Asignar responsable y próximo paso en pipeline comercial.',
        nav: nav('oportunidades'),
      });
    }
  }

  const calSob = u.operationalCalendarAlerts.filter((x) => x.code === 'CAL_TEC_SOBRECARGA');
  if (calSob.length) {
    push({
      code: 'JARVIS_CAL_SOBRECARGA',
      severity: 'warning',
      title: 'Calendario: técnico(es) sobrecargado(s) en la semana',
      detail: `${calSob.length} alerta(s) CAL_TEC_SOBRECARGA.`,
      recommendation: 'Redistribuir visitas o reprogramar en planificación operativa.',
      nav: nav('planificacion'),
    });
  }

  const termSinEco = otsClima.filter(
    (o) => o.estado === 'terminado' && (!economicsOk(o) || !o.pdfUrl)
  ).length;
  if (termSinEco > 0) {
    push({
      code: 'JARVIS_OT_TERM_SIN_CIERRE_ECO',
      severity: 'critical',
      title: 'OT terminadas sin cierre económico completo o PDF',
      detail: `${termSinEco} caso(s) alineados a reglas Intel (cobro/costo/PDF).`,
      recommendation: 'Completar economía persistida e informe en Clima.',
      nav: nav('clima'),
    });
  }

  for (const r of brief.flow?.risks || []) {
    if (r.code === 'PERMISO_SIN_RESPUESTA') {
      push({
        code: 'JARVIS_PERMISO_DETENIDO',
        severity: 'warning',
        title: 'Permiso / trámite detenido',
        detail: r.mensaje,
        recommendation: 'Seguimiento en Flota o planificación según referencia.',
        nav: nav('flota'),
      });
      break;
    }
  }

  const pendAp = (u.autopilot?.pendingApprovals || []).length;
  if (pendAp >= 6) {
    push({
      code: 'JARVIS_APROBACIONES_COLA',
      severity: 'info',
      title: 'Alto volumen de acciones Autopilot pendientes de aprobación',
      detail: `${pendAp} en cola.`,
      recommendation: 'Revisar Control operación / panel Autopilot y decidir en bloque.',
      nav: nav('operacion-control'),
    });
  }

  const sum = u.commercialSummary || {};
  if ((sum.countMes ?? 0) === 0 && (docs.filter((d) => d.estadoDocumento === 'aprobado').length >= 3)) {
    push({
      code: 'JARVIS_OP_CAIDA_MES',
      severity: 'info',
      title: 'Baja generación de oportunidades nuevas en el mes',
      detail: 'Hay aprobaciones documentales pero el pipeline comercial del mes está vacío o muy bajo.',
      recommendation: 'Verificar reglas Jarvis sobre informes y conversión a oportunidades.',
      nav: nav('oportunidades'),
    });
  }

  if (memorySummary?.alertasVistasRecientes?.length >= 8) {
    const opU = memorySummary.alertasVistasRecientes.filter((x) => String(x.code || '').includes('OP_URGENTE'));
    if (opU.length >= 3) {
      push({
        code: 'JARVIS_MEM_OP_URG_RECURRENTE',
        severity: 'warning',
        title: 'Patrón: urgentes comerciales vistos repetidamente',
        detail: 'La memoria Jarvis registra varias alertas de urgencia sin cierre aparente.',
        recommendation: 'Auditoría rápida de ownership comercial.',
        nav: nav('oportunidades'),
      });
    }
  }

  if (snapshot?.financiero?.utilidadMes < 0 && snapshot?.financiero?.ingresoRealMes > 0) {
    push({
      code: 'JARVIS_FIN_UTIL_NEG',
      severity: 'critical',
      title: 'Utilidad del mes negativa con ingreso real',
      detail: 'Consolidado financiero del snapshot operacional.',
      recommendation: 'Revisar costos y cobros en Clima y Flota.',
      nav: nav('jarvis'),
    });
  }

  const vaultAlerts = [...(u.historicalAlerts || [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
  const seenVault = new Set();
  for (const ha of vaultAlerts) {
    if (!ha?.title || seenVault.has(ha.code)) continue;
    seenVault.add(ha.code);
    if (seenVault.size > 8) break;
    push({
      code: ha.code || 'HV_JARVIS',
      severity: ha.severity || 'info',
      title: ha.title,
      detail: ha.detail,
      recommendation: ha.recommendation || 'Abrir Historical Vault para contexto y timeline.',
      nav: ha.nav || nav('jarvis-vault'),
    });
  }

  alerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return { version: JARVIS_CORE_VERSION, computedAt: new Date().toISOString(), alerts };
}

/**
 * Texto ejecutivo para pantalla (Hernán / Lyn).
 * @param {ReturnType<typeof getJarvisUnifiedState>} unified
 */
export function buildJarvisDirectorBrief(unified) {
  const u = unified || getJarvisUnifiedState({});
  const daily = buildJarvisDailyBrief(u);
  const execAlerts = computeJarvisExecutiveAlerts(u, null);
  const lines = [];

  lines.push(`Estado general: ${daily.estadoGeneral}`);
  lines.push('');
  lines.push('Prioridades (3):');
  daily.prioridadesCriticas.slice(0, 3).forEach((p, i) => {
    lines.push(`${i + 1}. ${p.titulo || p.codigo} (${p.modulo || '—'})`);
  });
  if (daily.prioridadesCriticas.length === 0) {
    lines.push('1. Mantener cierres y cobros del día');
    lines.push('2. Revisar documentos en revisión/observados');
    lines.push('3. Gestionar oportunidades comerciales urgentes');
  }
  lines.push('');
  lines.push('Riesgos (3):');
  const mergedRiesgos = [
    ...daily.riesgos.map((r) => ({
      mensaje: r.mensaje,
      criticidad: r.criticidad,
      code: r.code,
    })),
    ...issuesRiesgo(u),
    ...(execAlerts.alerts || []).map((a) => ({
      mensaje: a.title,
      criticidad: a.severity,
      code: a.code,
    })),
  ];
  const rTop = mergedRiesgos.slice(0, 3);
  rTop.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.mensaje || r.texto || r.code} [${r.criticidad || r.severity || '—'}]`);
  });
  if (rTop.length === 0) {
    lines.push('1. Sin riesgos destacados en este corte — mantener monitoreo.');
  }
  lines.push('');
  lines.push('Acciones inmediatas (3):');
  daily.accionesHoy.slice(0, 3).forEach((a, i) => {
    lines.push(`${i + 1}. ${a.titulo} → ${a.modulo || 'módulo'}`);
  });
  lines.push('');
  const fin = u.intelBrief?.snapshot?.financiero || {};
  lines.push(
    `Impacto económico visible: ingreso real mes $${Math.round(fin.ingresoRealMes || 0).toLocaleString('es-CL')}, utilidad $${Math.round(fin.utilidadMes || 0).toLocaleString('es-CL')}.`
  );
  lines.push(
    `Comercial pendiente: ${daily.comercial.urgentesPendientes} urgentes, potencial mes $${Math.round(daily.comercial.montoPotencial).toLocaleString('es-CL')}.`
  );
  lines.push('');
  lines.push('Historical Vault (memoria de negocio):');
  lines.push(
    `- Archivo: ${daily.historicalVault?.totalRecords ?? 0} registro(s), ${daily.historicalVault?.uniqueClients ?? 0} cliente(s) distinto(s), patrones ${daily.historicalVault?.patternsCount ?? 0}, alertas ${daily.historicalVault?.alertsCount ?? 0}.`
  );
  for (const a of (u.historicalAlerts || []).slice(0, 3)) {
    if (a?.title) lines.push(`- ${a.title}${a.detail ? ` — ${a.detail}` : ''}`);
  }
  lines.push('');
  const op = u.outlookFollowUp?.pendingByOwner || {};
  const oa = (u.outlookFollowUp?.delayAlerts || [])[0];
  lines.push('Outlook / correo (solo lectura):');
  lines.push(`- Pendientes abiertos — Romina: ${op.Romina?.length ?? 0}, Gery: ${op.Gery?.length ?? 0}, sin dueño: ${op.sin_dueño?.length ?? 0}.`);
  if (oa) {
    lines.push(`- Alerta prioritaria buzón: ${oa.title} (${oa.owner || '—'}).`);
  }
  lines.push('- Revisar permisos detenidos y correos críticos sin gestión en Jarvis Intake Hub.');
  lines.push('');
  lines.push('Cierre del día recomendado:');
  lines.push(
    `- Resolver bloqueos documentales (${daily.documentos.observados} observados, ${daily.documentos.aprobadosNoEnviados} aprobados sin envío).`
  );
  lines.push(`- Reducir cola crítica Intel (${u.intelBrief.executionQueue.filter((x) => x.tipo === 'CRITICO').length} ítems críticos en cola).`);
  const topEx = execAlerts.alerts[0];
  if (topEx) {
    lines.push(`- Alerta dirección prioritaria: ${topEx.title}.`);
  }

  return lines.join('\n');
}

function issuesRiesgo(u) {
  const issues = u.intelBrief?.issues || [];
  return issues
    .filter((i) => i.tipo === 'CRITICO')
    .map((i) => ({ mensaje: i.mensaje, code: i.code, criticidad: 'alta' }));
}
