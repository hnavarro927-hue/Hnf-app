import './styles/app.css';
import { appConfig, formatApiBaseLabel } from './config/app.config.js';
import { createShell } from './components/shell.js';
import {
  defaultViewForRole,
  getNavItemsForRole,
  isViewAllowedForRole,
  resolveOperatorRole,
} from './domain/hnf-operator-role.js';
import { clientService } from './services/client.service.js';
import { flotaSolicitudService } from './services/flota-solicitud.service.js';
import { expenseService } from './services/expense.service.js';
import { healthService } from './services/health.service.js';
import { probeBackendHealth } from './domain/hnf-connectivity.js';
import { registerHnfArchitectureDevHook } from './domain/hnf-architecture-contract.js';
import { safeExecute, safeAsync } from './domain/hnf-core.js';
import { loadViewCache, saveShellMeta, saveViewCache } from './domain/hnf-storage.js';
import { blobToDataUrl, generateOtPdfBlob } from './services/pdf.service.js';
import { otService } from './services/ot.service.js';
import { vehicleService } from './services/vehicle.service.js';
import { buildHnfAdnSnapshot } from './domain/hnf-adn.js';
import { climaView } from './views/clima.js';
import { flotaView } from './views/flota.js';
import { adminView } from './views/admin.js';
import { planificacionService } from './services/planificacion.service.js';
import { planificacionView } from './views/planificacion.js';
import { asistenteIaView } from './views/asistente-ia.js';
import { whatsappFeedView } from './views/whatsapp-feed.js';
import { operacionControlView } from './views/operacion-control.js';
import { panelOperativoVivoView } from './views/panel-operativo-vivo.js';
import { technicalDocumentsView } from './views/technical-documents.js';
import { oportunidadesView } from './views/oportunidades.js';
import { mergeJarvisOperativeStoresFromServer, getCentroIngestaState } from './domain/jarvis-active-intake-engine.js';
import { jarvisOperativeEventsService } from './services/jarvis-operative-events.service.js';
import { jarvisHqView } from './views/jarvis-hq.js';
import { jarvisIntakeHubView } from './views/jarvis-intake-hub.js';
import { jarvisVaultView } from './views/jarvis-vault.js';
import { ingresoOperativoView } from './views/ingreso-operativo.js';
import { hnfCoreHubView } from './views/hnf-core-hub.js';
import { finanzasOperativoView } from './views/finanzas-operativo.js';
import { equipoOperativoView } from './views/equipo-operativo.js';
import { controlGerencialView } from './views/control-gerencial.js';
import { hnfOperativoIntegradoService } from './services/hnf-operativo-integrado.service.js';
import { whatsappFeedService } from './services/whatsapp-feed.service.js';
import { outlookIntakeService } from './services/outlook-intake.service.js';
import { historicalVaultService } from './services/historical-vault.service.js';
import { technicalDocumentsService } from './services/technical-documents.service.js';
import { commercialOpportunitiesService } from './services/commercial-opportunities.service.js';
import { operationalCalendarService } from './services/operational-calendar.service.js';
import { operationalEventsService } from './services/operational-events.service.js';
import { hnfCoreSolicitudesService } from './services/hnf-core-solicitudes.service.js';
import {
  computeOperationalCalendarAlerts,
  defaultOperationalCalendarRange,
} from './domain/operational-calendar.js';
import * as hnfDocumentIntelligence from './domain/technical-document-intelligence.js';
import {
  formatAllCloseBlockersMessage,
  otCanClose,
} from './utils/ot-evidence.js';
import {
  analyzeTechnicalDocument,
  buildIntelExecutionQueue,
  detectOperationalIssues,
  generateActionPlan,
  getDirectorOperationalBrief,
  getOperationalSnapshot,
  INTEL_AUTOMATION_SCHEMA,
  runAIAnalysis,
} from './domain/hnf-intelligence-engine.js';
import * as hnfAutopilot from './domain/hnf-autopilot.js';
import * as hnfMemory from './domain/hnf-memory.js';
import {
  buildJarvisActionBoard,
  buildJarvisDailyBrief,
  buildJarvisDirectorBrief,
  computeJarvisExecutiveAlerts,
  explainJarvisDecision,
  getJarvisUnifiedState,
  runJarvisAutonomicCycle,
} from './domain/jarvis-core.js';
import { startJarvisAutonomicSurface } from './domain/jarvis-autonomic-surface.js';
import { buildJarvisDecisionEngine } from './domain/jarvis-decision-engine.js';
import { markJarvisInfinityEventResolved } from './domain/jarvis-infinity-engine.js';
import { JarvisMemoryEngine } from './domain/jarvis-memory-engine.js';
import { buildJarvisPresence, buildJarvisStartupSequence } from './domain/jarvis-presence-engine.js';
import {
  buildJarvisPresence as jarvisOsBuildPresence,
  buildJarvisDecisionEngine as jarvisOsBuildDecision,
  generarSaludo as jarvisOsGenerarSaludo,
  startJarvisAutonomousLoop,
  registerJarvisMemory as registerJarvisOsMemory,
  getJarvisMemory as getJarvisOsMemory,
  processJarvisInput,
} from '@/jarvis/jarvis-core.js';
import {
  notifyJarvisExternalEvent,
  startJarvisConsciousLoop,
  typewriterInto,
} from '@/jarvis/jarvis-conscious.js';
import {
  adjustHeuristics,
  appendMemoryEvent,
  detectPatternFromHistory,
  getAutonomicCycleMemorySummary,
  getEvolutiveMemoryEvents,
  getHistoricalVaultMemorySummary,
  getJarvisMemorySummary,
  getJarvisRecurringPatterns,
  getOutlookFollowUpMemorySummary,
  rememberHistoricalPattern,
  rememberHistoricalVaultImport,
  rememberJarvisAction,
  rememberJarvisBrief,
  rememberOutlookIntakeEvent,
} from './domain/jarvis-memory.js';
import {
  dismissJarvisOperationalTask,
  executeIntakeThroughActionPipeline,
  executeJarvisActions,
  getJarvisOperationalTasks,
} from './domain/jarvis-action-engine.js';
import { buildHistoricalTimeline, searchHistoricalVault } from './domain/historical-vault-intelligence.js';
import { getHNFJarvisControlApi } from './domain/jarvis-control-center.js';
import { getHNFJarvisPulseApi, setJarvisPulseContext } from './domain/jarvis-pulse-engine.js';
import { getHNFJarvisUIApi, isTabletMode } from './domain/jarvis-ui.js';
import {
  buildOutlookFollowUpSignals,
  classifyOutlookMessage,
} from './domain/outlook-intelligence.js';
import { createHnfAutoDeployIndicator } from './components/hnf-auto-deploy-indicator.js';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__HNF_DEV_CONSOLE_ERRORS__ = window.__HNF_DEV_CONSOLE_ERRORS__ || [];
  const cap = 16;
  const push = (m) => {
    window.__HNF_DEV_CONSOLE_ERRORS__.push({ t: Date.now(), m: String(m || '').slice(0, 280) });
    while (window.__HNF_DEV_CONSOLE_ERRORS__.length > cap) window.__HNF_DEV_CONSOLE_ERRORS__.shift();
  };
  window.addEventListener('error', (e) => push(e.error?.message || e.message || 'error'));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    push(r?.message || r || 'unhandledrejection');
  });
}

let hnfDeployIndicatorCtl = null;
const getHnfDeployIndicatorElement = () => {
  if (!import.meta.env.DEV) return null;
  if (!hnfDeployIndicatorCtl) {
    hnfDeployIndicatorCtl = createHnfAutoDeployIndicator();
    hnfDeployIndicatorCtl.start();
  }
  return hnfDeployIndicatorCtl.element;
};

const exposeIntelGlobals = () => {
  window.getOperationalSnapshot = getOperationalSnapshot;
  window.detectOperationalIssues = detectOperationalIssues;
  window.generateActionPlan = generateActionPlan;
  window.runAIAnalysis = runAIAnalysis;
  window.buildIntelExecutionQueue = buildIntelExecutionQueue;
  window.getDirectorOperationalBrief = getDirectorOperationalBrief;
  window.INTEL_AUTOMATION_SCHEMA = INTEL_AUTOMATION_SCHEMA;
  window.HNFIntelligenceEngine = {
    getOperationalSnapshot,
    detectOperationalIssues,
    generateActionPlan,
    runAIAnalysis,
    buildIntelExecutionQueue,
    getDirectorOperationalBrief,
    INTEL_AUTOMATION_SCHEMA,
    analyzeTechnicalDocument,
  };
  window.HNFAutopilot = hnfAutopilot;
  window.HNFMemory = hnfMemory;
  window.HNFDocumentIntelligence = hnfDocumentIntelligence;
  window.HNFDocumentApproval = {
    rememberApprovalPattern: hnfMemory.rememberApprovalPattern,
    getDocumentApprovalMemorySummary: hnfMemory.getDocumentApprovalMemorySummary,
  };
};

const exposeJarvisGlobals = () => {
  window.HNFJarvisCore = {
    getJarvisUnifiedState,
    buildJarvisDailyBrief,
    buildJarvisActionBoard,
    explainJarvisDecision,
    computeJarvisExecutiveAlerts,
    buildJarvisDirectorBrief,
    runJarvisAutonomicCycle,
    buildJarvisDecisionEngine,
    buildJarvisStartupSequence,
    buildJarvisPresence,
    JarvisMemoryEngine,
  };
  window.HNFJarvisOS = {
    buildJarvisPresence: jarvisOsBuildPresence,
    buildJarvisDecisionEngine: jarvisOsBuildDecision,
    registerJarvisMemory: registerJarvisOsMemory,
    getJarvisMemory: getJarvisOsMemory,
    processJarvisInput,
  };
  window.HNFJarvisOperador = {
    getJarvisOperationalTasks,
    dismissJarvisOperationalTask,
    executeJarvisActions,
    executeIntakeThroughActionPipeline,
  };
  window.HNFJarvisInfinity = {
    markEventResolved: markJarvisInfinityEventResolved,
  };
  window.HNFJarvisMemory = {
    rememberJarvisBrief,
    rememberJarvisAction,
    getJarvisMemorySummary,
    getJarvisRecurringPatterns,
    rememberOutlookIntakeEvent,
    getOutlookFollowUpMemorySummary,
    rememberHistoricalVaultImport,
    rememberHistoricalPattern,
    getHistoricalVaultMemorySummary,
    getAutonomicCycleMemorySummary,
    appendMemoryEvent,
    getEvolutiveMemoryEvents,
    detectPatternFromHistory,
    adjustHeuristics,
  };
  window.HNFHistoricalVault = {
    ingestHistoricalVaultBatch: (payload) => historicalVaultService.ingestBatch(payload),
    searchHistoricalVault: (query, context) => searchHistoricalVault(query, context),
    buildHistoricalTimeline: (records, filters) => buildHistoricalTimeline(records, filters),
  };
  window.HNFOutlookIntake = {
    classifyOutlookMessage,
    buildOutlookFollowUpSignals,
    ingestOutlookMessage: (msg, clientNames) => outlookIntakeService.ingestMessage(msg, clientNames),
    ingestOutlookBatch: (messages, clientNames) => outlookIntakeService.ingestBatch(messages, clientNames),
    ingestFolderDocuments: (payload) => outlookIntakeService.ingestFolder(payload),
  };
};

const app = document.querySelector('#app');
if (!app) {
  throw new Error('No se encontró #app en el DOM.');
}

if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('[HNF window.onerror]', { message, source, lineno, colno, error });
    return false;
  };
  window.addEventListener('unhandledrejection', (ev) => {
    console.error('[HNF unhandledrejection]', ev.reason);
  });
  registerHnfArchitectureDevHook();
  exposeIntelGlobals();
  exposeJarvisGlobals();
  window.HNFJarvisControl = getHNFJarvisControlApi();
  window.HNFJarvisPulse = getHNFJarvisPulseApi();
  window.HNFJarvisUI = getHNFJarvisUIApi();
  const syncJarvisViewportClass = () => {
    document.body.classList.toggle('hnf-viewport-tablet', isTabletMode());
  };
  syncJarvisViewportClass();
  window.addEventListener('resize', syncJarvisViewportClass);
}

const toListEnvelope = (fallback) => () => fallback;

/** Vistas que comparten el mismo snapshot operativo (misma función load). */
const VIEWS_WITH_UNIFIED_LOAD = new Set([
  'jarvis',
  'jarvis-intake',
  'bandeja-canal',
  'jarvis-vault',
  'asistente',
  'operacion-control',
  'ingreso-operativo',
  'control-gerencial',
  'hnf-core',
  'finanzas',
  'equipo',
]);

const minimalOperationalViewData = () => {
  const base = {
    health: {
      success: true,
      data: {
        status: 'ok',
        app: 'HNF API',
        database: { status: 'unknown', message: 'Datos mínimos tras error de procesamiento.' },
      },
      meta: { resource: 'health' },
    },
    ots: { data: [] },
    clients: { data: [] },
    vehicles: { data: [] },
    expenses: { data: [] },
    planClientes: [],
    planTiendas: [],
    planMantenciones: [],
    planOts: [],
    operationalCalendar: { entries: [] },
    operationalCalendarAlerts: [],
    technicalDocuments: [],
    technicalDocumentAlerts: [],
    commercialOpportunities: [],
    commercialOpportunityAlerts: [],
    flotaSolicitudes: [],
    whatsappFeed: {
      messages: [],
      ingestLogs: [],
      errors: [],
      operationalSummary: null,
    },
    outlookFeed: {
      messages: [],
      historicalImports: [],
      ingestErrors: [],
      lastIngestAt: null,
      futureOutlookHooks: {
        inboxSync: false,
        replyDraft: false,
        threadSync: false,
        sendMail: false,
        autoReply: false,
        outboundSync: false,
        note: 'Sin datos de Outlook.',
      },
      outlookIntakeMode: 'recepcion_solo_lectura',
    },
    historicalVault: { records: [], importBatches: [], computed: null },
    jarvisOperativeEvents: getCentroIngestaState().events,
    operationalPanelDaily: null,
    operationalEvents: [],
    hnfCoreSolicitudes: [],
    hnfValidationQueue: [],
    hnfValidatedMemory: [],
    hnfExtendedClients: [],
    hnfInternalDirectory: [],
  };
  base.hnfAdn = buildHnfAdnSnapshot(base);
  return base;
};

/** Carga unificada OT + planificación + flota + salud (Inicio y Asistente IA). Nunca rechaza: un fallo de sub-recurso no debe tumbar toda la app ni marcar “sin conexión”. */
const loadFullOperationalDataImpl = async () => {
  const opRange = defaultOperationalCalendarRange();
  const healthFallback = {
    success: true,
    data: {
      app: 'HNF API',
      status: 'ok',
      database: { status: 'unknown', message: 'Health no revalidado en este lote.' },
    },
    meta: { resource: 'health' },
  };
  const [
    health,
    ots,
    clients,
    vehicles,
    expenses,
    cr,
    tr,
    mr,
    sol,
    whatsappFeed,
    outlookFeed,
    ocMerged,
    techDocs,
    commercialOpps,
    historicalVault,
    operationalPanelDaily,
    operationalEvents,
    hnfCoreSolicitudesRaw,
    hnfValidationQueueRaw,
    hnfValidatedMemoryRaw,
    hnfExtendedClientsRaw,
    hnfInternalDirectoryRaw,
  ] = await Promise.all([
    healthService.getStatus().catch(toListEnvelope(healthFallback)),
    otService.getAll().catch(toListEnvelope({ data: [] })),
    clientService.getAll().catch(toListEnvelope({ data: [] })),
    vehicleService.getAll().catch(toListEnvelope({ data: [] })),
    expenseService.getAll().catch(toListEnvelope({ data: [] })),
    planificacionService.getClientes().catch(toListEnvelope({ data: [] })),
    planificacionService.getTiendas({}).catch(toListEnvelope({ data: [] })),
    planificacionService.getMantenciones({}).catch(toListEnvelope({ data: [] })),
    flotaSolicitudService.getAll({}).catch(toListEnvelope({ data: [] })),
    whatsappFeedService.getFeed().catch(() => ({
      messages: [],
      ingestLogs: [],
      errors: [],
      operationalSummary: null,
    })),
    outlookIntakeService.getFeed().catch(() => null),
    operationalCalendarService.getMerged(opRange).catch(() => ({ entries: [] })),
    technicalDocumentsService.getAll().catch(() => []),
    commercialOpportunitiesService.getAll().catch(() => []),
    historicalVaultService.getVault().catch(() => ({
      records: [],
      importBatches: [],
      computed: null,
    })),
    operationalEventsService.getDailyPanel().catch(() => null),
    operationalEventsService.listEvents().catch(() => []),
    hnfCoreSolicitudesService.getAll().catch(() => []),
    hnfOperativoIntegradoService.getValidationQueue().catch(() => []),
    hnfOperativoIntegradoService.getValidatedMemory().catch(() => []),
    hnfOperativoIntegradoService.getExtendedClients().catch(() => []),
    hnfOperativoIntegradoService.getInternalDirectory().catch(() => []),
  ]);

  const emptyOutlookFeed = {
    messages: [],
    historicalImports: [],
    ingestErrors: [],
    lastIngestAt: null,
    futureOutlookHooks: {
      inboxSync: false,
      replyDraft: false,
      threadSync: false,
      sendMail: false,
      autoReply: false,
      outboundSync: false,
      note: 'Sin datos de Outlook en este lote.',
    },
    outlookIntakeMode: 'recepcion_solo_lectura',
  };
  const outlookFeedNorm =
    outlookFeed && typeof outlookFeed === 'object' ? outlookFeed : { ...emptyOutlookFeed };

  const planClientes = cr.data ?? [];
  const planTiendas = tr.data ?? [];
  const planMantenciones = mr.data ?? [];
  const planOts = ots?.data ?? (Array.isArray(ots) ? ots : []);
  const operationalCalendar =
    ocMerged && typeof ocMerged === 'object' ? ocMerged : { entries: [] };
  const operationalCalendarAlerts = computeOperationalCalendarAlerts({
    entries: Array.isArray(operationalCalendar.entries) ? operationalCalendar.entries : [],
    ots: planOts,
    mantenciones: planMantenciones,
    tiendas: planTiendas,
    clientes: planClientes,
  });

  const technicalDocuments = Array.isArray(techDocs) ? techDocs : [];
  const technicalDocumentAlerts = hnfDocumentIntelligence.computeTechnicalDocumentAlerts(
    technicalDocuments,
    planOts
  );

  const commercialOpportunities = Array.isArray(commercialOpps) ? commercialOpps : [];
  const commercialOpportunityAlerts =
    hnfDocumentIntelligence.computeCommercialOpportunityAlerts(commercialOpportunities);

  const hnfCoreSolicitudes = Array.isArray(hnfCoreSolicitudesRaw) ? hnfCoreSolicitudesRaw : [];
  const hnfValidationQueue = Array.isArray(hnfValidationQueueRaw) ? hnfValidationQueueRaw : [];
  const hnfValidatedMemory = Array.isArray(hnfValidatedMemoryRaw) ? hnfValidatedMemoryRaw : [];
  const hnfExtendedClients = Array.isArray(hnfExtendedClientsRaw) ? hnfExtendedClientsRaw : [];
  const hnfInternalDirectory = Array.isArray(hnfInternalDirectoryRaw) ? hnfInternalDirectoryRaw : [];

  let jarvisOperativeEvents = [];
  try {
    const jr = await jarvisOperativeEventsService.getAll();
    const apiEv = Array.isArray(jr?.events) ? jr.events : [];
    mergeJarvisOperativeStoresFromServer(apiEv);
    jarvisOperativeEvents = getCentroIngestaState().events;
  } catch {
    jarvisOperativeEvents = getCentroIngestaState().events;
  }

  const payload = {
    health,
    ots,
    clients,
    vehicles,
    expenses,
    planClientes,
    planTiendas,
    planMantenciones,
    planOts,
    operationalCalendar,
    operationalCalendarAlerts,
    technicalDocuments,
    technicalDocumentAlerts,
    commercialOpportunities,
    commercialOpportunityAlerts,
    flotaSolicitudes: sol.data ?? [],
    whatsappFeed,
    outlookFeed: outlookFeedNorm,
    historicalVault,
    jarvisOperativeEvents,
    operationalPanelDaily,
    operationalEvents: Array.isArray(operationalEvents) ? operationalEvents : [],
    hnfCoreSolicitudes,
    hnfValidationQueue,
    hnfValidatedMemory,
    hnfExtendedClients,
    hnfInternalDirectory,
  };
  payload.hnfAdn = buildHnfAdnSnapshot(payload);
  return payload;
};

const loadFullOperationalData = async () => {
  try {
    return await loadFullOperationalDataImpl();
  } catch (e) {
    console.warn('[HNF] loadFullOperationalData', e);
    return minimalOperationalViewData();
  }
};

const loadTechnicalDocumentsView = async () => {
  const [ots, docs] = await Promise.all([
    otService.getAll().catch(() => ({ data: [] })),
    technicalDocumentsService.getAll().catch(() => []),
  ]);
  const planOts = ots?.data ?? (Array.isArray(ots) ? ots : []);
  const technicalDocuments = Array.isArray(docs) ? docs : [];
  return {
    ots,
    technicalDocuments,
    technicalDocumentAlerts: hnfDocumentIntelligence.computeTechnicalDocumentAlerts(
      technicalDocuments,
      planOts
    ),
  };
};

const viewRegistry = {
  'ingreso-operativo': {
    render: ingresoOperativoView,
    load: loadFullOperationalData,
  },

  'hnf-core': {
    render: hnfCoreHubView,
    load: loadFullOperationalData,
  },

  finanzas: {
    render: finanzasOperativoView,
    load: loadFullOperationalData,
  },

  equipo: {
    render: equipoOperativoView,
    load: loadFullOperationalData,
  },

  jarvis: {
    render: jarvisHqView,
    load: loadFullOperationalData,
  },

  'jarvis-intake': {
    render: jarvisIntakeHubView,
    load: loadFullOperationalData,
  },

  'bandeja-canal': {
    render: jarvisIntakeHubView,
    load: loadFullOperationalData,
  },

  'jarvis-vault': {
    render: jarvisVaultView,
    load: loadFullOperationalData,
  },

  asistente: {
    render: asistenteIaView,
    load: loadFullOperationalData,
  },

  'operacion-control': {
    render: operacionControlView,
    load: loadFullOperationalData,
  },

  'control-gerencial': {
    render: controlGerencialView,
    load: loadFullOperationalData,
  },

  'panel-operativo-vivo': {
    render: panelOperativoVivoView,
    load: async () => {
      const [operationalPanelDaily, operationalEvents] = await Promise.all([
        operationalEventsService.getDailyPanel().catch(() => null),
        operationalEventsService.listEvents().catch(() => []),
      ]);
      return { operationalPanelDaily, operationalEvents };
    },
  },

  whatsapp: {
    render: whatsappFeedView,
    load: async () => {
      const feed = await whatsappFeedService.getFeed().catch(() => ({
        messages: [],
        ingestLogs: [],
        errors: [],
        operationalSummary: null,
      }));
      return { feed, whatsappFeed: feed };
    },
  },

  clima: {
    render: climaView,
    load: async () => otService.getAll().catch(() => ({ data: [] })),
  },

  'documentos-tecnicos': {
    render: technicalDocumentsView,
    load: loadTechnicalDocumentsView,
  },

  'technical-documents': {
    render: technicalDocumentsView,
    load: loadTechnicalDocumentsView,
  },

  oportunidades: {
    render: oportunidadesView,
    load: loadFullOperationalData,
  },

  planificacion: {
    render: planificacionView,
    load: async () => {
      const opRange = defaultOperationalCalendarRange();
      const [cr, tr, mr, ots, ocMerged] = await Promise.all([
        planificacionService.getClientes().catch(() => ({ data: [] })),
        planificacionService.getTiendas({}).catch(() => ({ data: [] })),
        planificacionService.getMantenciones({}).catch(() => ({ data: [] })),
        otService.getAll().catch(() => ({ data: [] })),
        operationalCalendarService.getMerged(opRange).catch(() => ({ entries: [] })),
      ]);
      const planClientes = cr.data ?? [];
      const planTiendas = tr.data ?? [];
      const planMantenciones = mr.data ?? [];
      const planOts = ots?.data ?? (Array.isArray(ots) ? ots : []);
      const operationalCalendar =
        ocMerged && typeof ocMerged === 'object' ? ocMerged : { entries: [] };
      const operationalCalendarAlerts = computeOperationalCalendarAlerts({
        entries: Array.isArray(operationalCalendar.entries) ? operationalCalendar.entries : [],
        ots: planOts,
        mantenciones: planMantenciones,
        tiendas: planTiendas,
        clientes: planClientes,
      });
      return {
        planClientes,
        planTiendas,
        planMantenciones,
        planOts,
        operationalCalendar,
        operationalCalendarAlerts,
      };
    },
  },

  flota: {
    render: flotaView,
    load: async () => {
      const [vehicles, expenses, sol] = await Promise.all([
        vehicleService.getAll().catch(() => ({ data: [] })),
        expenseService.getAll().catch(() => ({ data: [] })),
        flotaSolicitudService.getAll({}).catch(() => ({ data: [] })),
      ]);

      return { vehicles, expenses, flotaSolicitudes: sol.data ?? [] };
    },
  },

  admin: {
    render: adminView,
    load: async () => {
      const [clients, ots, expenses] = await Promise.all([
        clientService.getAll().catch(() => ({ data: [] })),
        otService.getAll().catch(() => ({ data: [] })),
        expenseService.getAll().catch(() => ({ data: [] })),
      ]);

      return { clients, ots, expenses };
    },
  },
};

const openPdfBlobInNewTab = (blob) => {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.append(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 180000);
};

/** Estado shell global. `integrationStatus` solo debe mutarse en este archivo (ver hnf-architecture-contract.js). */
const state = {
  activeView: 'jarvis',
  integrationStatus: 'pendiente',
  viewData: null,
  selectedOTId: null,
  selectedFlotaId: null,
  otFeedback: null,
  flotaFeedback: null,
  adminFeedback: null,
  lastSuccessfulFetchAt: null,
  isSubmittingOT: false,
  isUpdatingOTStatus: false,
  isClosingOT: false,
  isUploadingEvidence: false,
  isGeneratingPdf: false,
  isSavingEquipos: false,
  isSavingVisitText: false,
  isSavingOtEconomics: false,
  isPatchingOtOperational: false,
  /** Resultado económico persistido en servidor (válido) para la OT seleccionada en Clima */
  otEconomicsSaved: false,
  /** Navegación desde Intelligence Engine (se aplica tras cargar datos). */
  pendingIntelNav: null,
  /** Tras redirigir control-operativo → jarvis, scroll al bloque #hnf-mando-principal-v2 */
  pendingScrollToMando: false,
  climaIntelFilter: null,
  flotaIntelFilter: null,
  /** Contexto planificación (un disparo por navegación intel). */
  planIntelOneShot: null,
  /** Banner guía (por qué / qué hacer / desbloqueo) tras navegar desde inteligencia. */
  intelGuidanceOneShot: null,
  /** Borrador / foco comercial al abrir Oportunidades desde Jarvis (un disparo hasta cerrar o salir). */
  commercialIntelOneShot: null,
};

let jarvisOsLastUi = null;
let jarvisOsLastSaludo = '';
let jarvisOsLastMensaje = '';
let jarvisOsLastMantra = '';

const estadoSistema = {
  bloqueos: 292600,
  oportunidades: 1,
};

if (typeof window !== 'undefined' && window.HNFJarvisOS) {
  window.HNFJarvisOS.estadoSistema = estadoSistema;
  window.HNFJarvisOS.generarSaludo = jarvisOsGenerarSaludo;
}

const getJarvisOsState = () => {
  const d = state.viewData;
  if (!d || typeof d !== 'object') return { bloqueos: 0, oportunidades: 0 };
  const ots = d.ots?.data || [];
  let bloqueos = 0;
  for (const o of ots) {
    if (String(o.estado || '') === 'terminado') continue;
    bloqueos += roundOtMoney(
      o.montoPresupuestado ?? o.montoEstimado ?? o.montoCobrado ?? o.monto ?? 0
    );
  }
  for (const s of d.flotaSolicitudes || []) {
    if (String(s.estado || '').toLowerCase() === 'cerrada') continue;
    bloqueos += roundOtMoney(s.ingresoFinal || s.ingresoEstimado || s.monto || 0);
  }
  const opps = Array.isArray(d.commercialOpportunities) ? d.commercialOpportunities : [];
  const oportunidades = opps.filter((p) => {
    const e = String(p.estado || '').toLowerCase();
    return e && !['perdida', 'cerrada', 'descartada'].includes(e);
  }).length;
  return { bloqueos, oportunidades };
};

const getJarvisOsMergedState = () =>
  state.viewData ? getJarvisOsState() : estadoSistema;

const applyJarvisOsUi = (payload) => {
  if (!payload?.presence || !payload?.decision) return;
  const root = document.getElementById('hnf-jarvis-presence-root');
  if (!root) return;
  const { presence, decision } = payload;
  const saludo = root.querySelector('.jarvis-presence__saludo');
  const mensaje = root.querySelector('.jarvis-presence__mensaje');
  const mantra = root.querySelector('.jarvis-presence__mantra');
  const decisionLine = root.querySelector('.jarvis-presence__decision-line');
  if (saludo) {
    const nextS = presence.saludo || '';
    if (nextS !== jarvisOsLastSaludo) {
      jarvisOsLastSaludo = nextS;
      typewriterInto(saludo, nextS, 11);
    }
  }
  if (mensaje) {
    const nextM = presence.mensaje || '';
    if (nextM !== jarvisOsLastMensaje) {
      jarvisOsLastMensaje = nextM;
      typewriterInto(mensaje, nextM, 9);
    }
  }
  if (mantra) {
    const nextMa = presence.mantra || '';
    if (nextMa !== jarvisOsLastMantra) {
      jarvisOsLastMantra = nextMa;
      typewriterInto(mantra, nextMa, 8);
    }
  }
  if (decisionLine) {
    const imp = Number(decision.impacto || 0);
    decisionLine.textContent = `${decision.accion || '—'} · Prioridad ${decision.prioridad || '—'} · Impacto $${imp.toLocaleString('es-CL')}`;
  }
  root.dataset.jarvisEstado = String(presence.estado || 'NORMAL').toLowerCase();
  root.dataset.jarvisPrioridad = String(decision.prioridad || 'NORMAL').toLowerCase();
  root.classList.add('jarvis-presence--data-flash');
  setTimeout(() => root.classList.remove('jarvis-presence--data-flash'), 620);
};

const roundOtMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const otHasValidSavedEconomics = (ot) =>
  Boolean(ot && roundOtMoney(ot.montoCobrado) > 0 && roundOtMoney(ot.costoTotal) > 0);

const recomputeOtEconomicsSaved = () => {
  if (state.activeView !== 'clima') return;
  const ots = state.viewData?.data || [];
  const ot = ots.find((item) => item.id === state.selectedOTId);
  state.otEconomicsSaved = otHasValidSavedEconomics(ot);
};

const syncSelectedOT = () => {
  if (state.activeView !== 'clima') return;

  const ots = state.viewData?.data || [];
  if (!ots.length) {
    state.selectedOTId = null;
    return;
  }

  const exists = ots.some((item) => item.id === state.selectedOTId);
  if (!exists) {
    state.selectedOTId = ots[0]?.id ?? null;
  }
};

const syncSelectedFlota = () => {
  if (state.activeView !== 'flota') return;
  const list = state.viewData?.flotaSolicitudes || [];
  if (!list.length) {
    state.selectedFlotaId = null;
    return;
  }
  const exists = list.some((s) => s.id === state.selectedFlotaId);
  if (!exists) {
    state.selectedFlotaId = list[0]?.id ?? null;
  }
};

const applyIntelNavigationAfterLoad = () => {
  const p = state.pendingIntelNav;
  state.pendingIntelNav = null;
  if (!state.viewData) return;
  if (!p) return;

  if (state.activeView === 'clima') {
    if (p.otId) {
      const ots = state.viewData?.data || [];
      if (ots.some((o) => o.id === p.otId)) state.selectedOTId = p.otId;
    }
    if (p.climaFilter && typeof p.climaFilter === 'object' && Object.keys(p.climaFilter).length) {
      state.climaIntelFilter = { ...p.climaFilter };
    }
  }

  if (state.activeView === 'flota') {
    if (p.flotaId) {
      const list = state.viewData?.flotaSolicitudes || [];
      if (list.some((s) => s.id === p.flotaId)) state.selectedFlotaId = p.flotaId;
    }
    if (p.flotaFilter && typeof p.flotaFilter === 'object' && Object.keys(p.flotaFilter).length) {
      state.flotaIntelFilter = { ...p.flotaFilter };
    }
  }

  if (state.activeView === 'planificacion' && p.plan && typeof p.plan === 'object') {
    state.planIntelOneShot = { ...p.plan };
  }

  if (p.guidance && typeof p.guidance === 'object') {
    state.intelGuidanceOneShot = { ...p.guidance };
  } else {
    state.intelGuidanceOneShot = null;
  }

  if (state.activeView === 'oportunidades') {
    state.commercialIntelOneShot =
      p.commercial && typeof p.commercial === 'object' ? { ...p.commercial } : null;
  }
};

const createActions = () => ({
  selectOT: (id) => {
    state.selectedOTId = id;
    recomputeOtEconomicsSaved();
    render();
  },

  invalidateOtEconomicsSaved: () => {
    state.otEconomicsSaved = false;
    render();
  },

  showFeedback: (fb) => {
    state.otFeedback = fb;
    render();
  },

  setFlotaFeedback: (fb) => {
    state.flotaFeedback = fb;
    render();
  },

  selectFlota: (id) => {
    state.selectedFlotaId = id;
    render();
  },

  setAdminFeedback: (fb) => {
    state.adminFeedback = fb;
    render();
  },

  clearIntelUiFilters: () => {
    state.climaIntelFilter = null;
    state.flotaIntelFilter = null;
    state.intelGuidanceOneShot = null;
    state.commercialIntelOneShot = null;
    render();
  },

  dismissIntelGuidance: () => {
    state.intelGuidanceOneShot = null;
    render();
  },

  dismissCommercialIntel: () => {
    state.commercialIntelOneShot = null;
    render();
  },

  consumePlanIntelContext: () => {
    state.planIntelOneShot = null;
  },

  createOT: async (payload) => {
    state.isSubmittingOT = true;
    state.otFeedback = null;
    render();

    try {
      const response = await otService.create(payload);
      state.selectedOTId = response.data.id;
      state.otFeedback = {
        type: 'success',
        message: 'OT creada. Seleccionála en el listado para cargar equipos, evidencias y cierre.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudo crear la orden de trabajo. Revisá los datos o la conexión.',
      };
      render();
    } finally {
      state.isSubmittingOT = false;
      render();
    }
  },

  patchOtOperational: async (id, body) => {
    state.isPatchingOtOperational = true;
    state.otFeedback = null;
    render();
    try {
      await otService.patchOperational(id, body);
      state.otFeedback = {
        type: 'success',
        message: 'Modo, técnico u origen actualizados en el servidor.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudo guardar el control operativo de la OT.',
      };
      render();
    } finally {
      state.isPatchingOtOperational = false;
      render();
    }
  },

  updateOTStatus: async (id, status) => {
    state.isUpdatingOTStatus = true;
    state.otFeedback = null;
    render();

    try {
      await otService.updateStatus(id, { estado: status });
      state.otFeedback = {
        type: 'success',
        message: `Estado actualizado a «${status}» (guardado en servidor).`,
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message:
          error.message ||
          'No se pudo cambiar el estado. Revisá fotos por equipo, checklist, resumen y recomendaciones si intentás cerrar la OT.',
      };
      render();
    } finally {
      state.isUpdatingOTStatus = false;
      render();
    }
  },

  addEvidences: async (id, payload) => {
    state.isUploadingEvidence = true;
    state.otFeedback = null;
    render();

    try {
      await otService.patchEvidences(id, payload);
      state.otFeedback = {
        type: 'success',
        message: 'Evidencias guardadas en la OT.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No fue posible agregar evidencias.',
      };
      render();
    } finally {
      state.isUploadingEvidence = false;
      render();
    }
  },

  saveOtEconomics: async (id, payload) => {
    state.isSavingOtEconomics = true;
    state.otFeedback = null;
    render();
    try {
      await otService.patchEconomics(id, payload);
      state.otFeedback = {
        type: 'success',
        message:
          'Costos e ingreso guardados en el servidor (CLP). La utilidad y el costo total se recalcularon en backend; la vista se actualizó.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudieron guardar los datos económicos.',
      };
      render();
    } finally {
      state.isSavingOtEconomics = false;
      render();
    }
  },

  saveVisitText: async (id, payload) => {
    state.isSavingVisitText = true;
    state.otFeedback = null;
    render();
    try {
      await otService.patchVisit(id, payload);
      state.otFeedback = {
        type: 'success',
        message: 'Textos de visita guardados en el servidor.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudieron guardar los textos de la visita.',
      };
      render();
    } finally {
      state.isSavingVisitText = false;
      render();
    }
  },

  saveEquipos: async (id, equiposPayload) => {
    state.isSavingEquipos = true;
    state.otFeedback = null;
    render();
    try {
      await otService.patchEquipos(id, { equipos: equiposPayload });
      state.otFeedback = {
        type: 'success',
        message: 'Equipos y evidencias guardados. Podés seguir editando o generar PDF de prueba.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudieron guardar equipos y fotos. Reintentá o revisá la conexión.',
      };
      render();
    } finally {
      state.isSavingEquipos = false;
      render();
    }
  },

  generatePdfFromOt: async (ot) => {
    if (state.isGeneratingPdf) return;
    const id = ot?.id;
    state.isGeneratingPdf = true;
    state.otFeedback = null;
    render();
    try {
      if (state.activeView === 'clima' && id) {
        await loadViewData();
      }
      const snap =
        id && state.viewData?.data
          ? state.viewData.data.find((o) => o.id === id) || ot
          : ot;
      const { blob, fileName } = await generateOtPdfBlob(snap);
      openPdfBlobInNewTab(blob);
      state.otFeedback = {
        type: 'success',
        message: `PDF abierto (${fileName}). Refleja la última carga del servidor; cambios sin guardar no entran.`,
      };
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudo generar el PDF.',
      };
    } finally {
      state.isGeneratingPdf = false;
      render();
    }
  },

  // Cierre OT: alinear con buildOtOperationalBrief (Clima) para futura capa IA operativa.
  closeAndGenerateReport: async (ot, economicsPayload = null) => {
    const id = ot?.id;
    if (!id) return;
    if (state.isClosingOT) return;

    let fresh = state.viewData?.data?.find((o) => o.id === id) || ot;

    if (!state.otEconomicsSaved && economicsPayload != null && fresh.estado !== 'terminado') {
      state.isSavingOtEconomics = true;
      state.otFeedback = null;
      render();
      try {
        await otService.patchEconomics(id, economicsPayload);
        await loadViewData();
        fresh = state.viewData?.data?.find((o) => o.id === id) || fresh;
      } catch (error) {
        state.otFeedback = {
          type: 'error',
          message: error.message || 'No se pudieron guardar los datos económicos.',
        };
        state.isSavingOtEconomics = false;
        render();
        return;
      } finally {
        state.isSavingOtEconomics = false;
      }
    }

    if (!state.otEconomicsSaved) {
      state.otFeedback = {
        type: 'error',
        message:
          economicsPayload != null
            ? 'No quedó un resultado económico válido en el servidor (monto cobrado y costo total deben ser mayores que cero). Revisá los importes y guardá de nuevo.'
            : 'Debes guardar el resultado económico antes de cerrar la OT.',
      };
      render();
      return;
    }

    fresh = state.viewData?.data?.find((o) => o.id === id) || fresh;
    if (!fresh) {
      state.otFeedback = {
        type: 'error',
        message: 'No se encontró la orden de trabajo actualizada.',
      };
      render();
      return;
    }

    if (roundOtMoney(fresh.montoCobrado) <= 0 || roundOtMoney(fresh.costoTotal) <= 0) {
      state.otFeedback = {
        type: 'error',
        message:
          'El monto cobrado y el costo total guardados en el servidor deben ser mayores que cero antes de cerrar.',
      };
      render();
      return;
    }

    if (!otCanClose(fresh)) {
      state.otFeedback = {
        type: 'error',
        message: formatAllCloseBlockersMessage(fresh),
      };
      render();
      return;
    }

    state.isClosingOT = true;
    state.otFeedback = null;
    render();

    try {
      await otService.updateStatus(id, { estado: 'terminado' });
      await loadViewData();
      fresh = state.viewData?.data?.find((o) => o.id === id) || {
        ...fresh,
        estado: 'terminado',
      };
      const otClosed = { ...fresh, estado: 'terminado' };
      const { blob, fileName } = await generateOtPdfBlob(otClosed);
      openPdfBlobInNewTab(blob);
      const pdfUrl = await blobToDataUrl(blob);
      await otService.patchReport(id, { pdfName: fileName, pdfUrl });
      state.otFeedback = {
        type: 'success',
        message:
          'OT cerrada (terminado). Informe PDF guardado en la orden; revisá la pestaña abierta.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudo cerrar la visita con informe. Revisá evidencias y conexión.',
      };
      render();
    } finally {
      state.isClosingOT = false;
      render();
    }
  },
});

async function navigateToView(viewId, intelOptions = null) {
  if (viewId === 'jarvis-intake') viewId = 'bandeja-canal';
  if (viewId === 'dashboard') {
    viewId = 'jarvis';
    state.pendingScrollToMando = true;
  }
  if (viewId === 'control-operativo-tiempo-real') {
    viewId = 'jarvis';
    state.pendingScrollToMando = true;
  }
  if (!viewRegistry[viewId]) return;
  const opRole = resolveOperatorRole();
  if (!isViewAllowedForRole(opRole, viewId)) {
    viewId = defaultViewForRole(opRole);
    state.pendingScrollToMando = false;
  }
  state.activeView = viewId;
  if (viewId !== 'oportunidades') {
    state.commercialIntelOneShot = null;
  }
  try {
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', `#/${viewId}`);
    }
  } catch {
    /* file:// u orígenes restringidos */
  }
  state.integrationStatus = 'cargando';
  if (!intelOptions || typeof intelOptions !== 'object') {
    state.intelGuidanceOneShot = null;
  }
  state.pendingIntelNav = intelOptions && typeof intelOptions === 'object' ? intelOptions : null;
  if (viewId !== 'clima') {
    state.otFeedback = null;
    state.climaIntelFilter = null;
  }
  if (viewId !== 'flota') {
    state.flotaFeedback = null;
    state.flotaIntelFilter = null;
  }
  if (viewId !== 'planificacion') {
    state.planIntelOneShot = null;
  }
  if (viewId !== 'admin') {
    state.adminFeedback = null;
  }
  render();
  await loadViewData();
}

/** Fallback global si falla todo el render (shell incluido). */
function paintGlobalRenderFallback() {
  if (!app) return;
  safeExecute(
    'paintGlobalRenderFallback',
    () => {
      app.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'tarjeta';
      wrap.style.cssText = 'margin:1rem;padding:1.25rem;max-width:42rem;font-family:system-ui,sans-serif;';
      const t = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = 'HNF — Error al dibujar la interfaz.';
      t.append(strong);
      const sub = document.createElement('p');
      sub.className = 'muted small';
      sub.textContent = 'Reintentá la carga o actualizá la página.';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button';
      b.textContent = 'Reintentar carga';
      b.addEventListener('click', () => {
        void loadViewData();
      });
      wrap.append(t, sub, b);
      app.append(wrap);
    },
    () => {
      try {
        app.textContent = 'HNF: error crítico. Recargá la página.';
      } catch {
        /* ignore */
      }
    }
  );
}

/**
 * `conectado` / `sin conexión` SOLO según resultado de probeBackendHealth (FASE 6).
 * Sin backend: intenta vista desde caché local.
 */
function applyConnectivityFromProbeResult(p) {
  if (p?.ok) {
    state.integrationStatus = 'conectado';
    return;
  }
  state.integrationStatus = 'sin conexión';
  const cached = loadViewCache(state.activeView);
  state.viewData = cached ?? null;
}

const render = () => {
  safeExecute(
    'render',
    () => {
      if (typeof window !== 'undefined' && window.__hnfPulseUiTimer) {
        clearInterval(window.__hnfPulseUiTimer);
        window.__hnfPulseUiTimer = null;
      }
      if (typeof window !== 'undefined' && window.__hnfJarvisDayCommandTimer) {
        clearInterval(window.__hnfJarvisDayCommandTimer);
        window.__hnfJarvisDayCommandTimer = null;
      }

      setJarvisPulseContext({
        getViewData: () => state.viewData,
        getLastDataRefreshAt: () => state.lastSuccessfulFetchAt,
      });

      const currentView = viewRegistry[state.activeView];
      app.innerHTML = '';

      const shell = createShell({
        activeView: state.activeView,
        apiBaseLabel: formatApiBaseLabel(),
        integrationStatus: state.integrationStatus,
        onNavigate: (viewId) => navigateToView(viewId),
        deployStatusElement: getHnfDeployIndicatorElement(),
        navItems: getNavItemsForRole(resolveOperatorRole()),
      });

      const intelNavigate = (nav) => {
        if (!nav?.view) return;
        if (nav.view === 'jarvis' && nav.focusMando) {
          state.pendingScrollToMando = true;
        }
        if (nav.view === 'dashboard') {
          navigateToView('jarvis');
          return;
        }
        if (nav.view === 'flujo-operativo-unificado') {
          state.pendingScrollToMando = true;
          navigateToView('jarvis', {
            otId: nav.otId,
            flotaId: nav.flotaId,
            climaFilter: nav.climaFilter,
            flotaFilter: nav.flotaFilter,
            plan: nav.plan,
            guidance: nav.guidance,
            commercial: nav.commercial,
          });
          return;
        }
        navigateToView(nav.view, {
          otId: nav.otId,
          flotaId: nav.flotaId,
          climaFilter: nav.climaFilter,
          flotaFilter: nav.flotaFilter,
          plan: nav.plan,
          guidance: nav.guidance,
          commercial: nav.commercial,
        });
      };

      shell.content.className = `content content--view-${state.activeView}`;
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('hnf-view--control-operativo', false);
        document.body.classList.toggle(
          'hnf-view--jarvis-principal',
          state.activeView === 'jarvis'
        );

        const opThemeClasses = [
          'hnf-op-theme--ingreso',
          'hnf-op-theme--bandeja',
          'hnf-op-theme--clima',
          'hnf-op-theme--flota',
          'hnf-op-theme--planificacion',
          'hnf-op-theme--comercial',
          'hnf-op-theme--control',
          'hnf-op-theme--finanzas',
          'hnf-op-theme--neutral',
        ];
        opThemeClasses.forEach((c) => document.body.classList.remove(c));

        const opCommandViews = new Set([
          'ingreso-operativo',
          'bandeja-canal',
          'jarvis-intake',
          'clima',
          'flota',
          'planificacion',
          'oportunidades',
          'control-gerencial',
          'finanzas',
          'operacion-control',
          'equipo',
          'whatsapp',
          'hnf-core',
          'documentos-tecnicos',
          'technical-documents',
          'panel-operativo-vivo',
        ]);
        const opThemeByView = {
          'ingreso-operativo': 'ingreso',
          'bandeja-canal': 'bandeja',
          'jarvis-intake': 'bandeja',
          clima: 'clima',
          flota: 'flota',
          planificacion: 'planificacion',
          oportunidades: 'comercial',
          'control-gerencial': 'control',
          finanzas: 'finanzas',
          'operacion-control': 'control',
        };
        const useOpShell = opCommandViews.has(state.activeView) && state.activeView !== 'jarvis';
        document.body.classList.toggle('hnf-op-command', useOpShell);
        if (useOpShell) {
          const th = opThemeByView[state.activeView] || 'neutral';
          document.body.classList.add(`hnf-op-theme--${th}`);
        }
      }

      const viewProps = {
        apiBaseLabel: formatApiBaseLabel(),
        integrationStatus: state.integrationStatus,
        lastDataRefreshAt: state.lastSuccessfulFetchAt,
        data: state.viewData,
        actions: createActions(),
        feedback: state.otFeedback,
        flotaFeedback: state.flotaFeedback,
        adminFeedback: state.adminFeedback,
        isSubmitting: state.isSubmittingOT,
        isUpdatingStatus: state.isUpdatingOTStatus,
        isClosingOT: state.isClosingOT,
        isUploadingEvidence: state.isUploadingEvidence,
        isGeneratingPdf: state.isGeneratingPdf,
        isSavingEquipos: state.isSavingEquipos,
        isSavingVisitText: state.isSavingVisitText,
        isSavingOtEconomics: state.isSavingOtEconomics,
        isPatchingOtOperational: state.isPatchingOtOperational,
        otEconomicsSaved: state.otEconomicsSaved,
        selectedOTId: state.selectedOTId,
        selectedFlotaId: state.selectedFlotaId,
        reloadApp: loadViewData,
        navigateToView,
        intelNavigate,
        intelListFilter: state.activeView === 'clima' ? state.climaIntelFilter : null,
        flotaIntelFilter: state.activeView === 'flota' ? state.flotaIntelFilter : null,
        intelPlanContext: state.activeView === 'planificacion' ? state.planIntelOneShot : null,
        intelGuidance:
          state.activeView === 'clima' || state.activeView === 'flota' || state.activeView === 'planificacion'
            ? state.intelGuidanceOneShot
            : null,
        commercialIntelContext: state.activeView === 'oportunidades' ? state.commercialIntelOneShot : null,
      };

      try {
        if (!currentView?.render) {
          throw new Error(`Vista desconocida: ${state.activeView}`);
        }
        shell.content.append(currentView.render(viewProps));
      } catch (err) {
        console.error('[HNF] Error al renderizar la vista', state.activeView, err);
        const fall = document.createElement('div');
        fall.className = 'tarjeta';
        fall.setAttribute('role', 'alert');
        const t = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = 'No se pudo dibujar esta pantalla.';
        t.append(strong);
        const m = document.createElement('p');
        m.className = 'muted small';
        m.textContent = err?.message ? String(err.message) : String(err);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary-button';
        b.textContent = 'Reintentar carga';
        b.addEventListener('click', () => {
          void loadViewData();
        });
        fall.append(t, m, b);
        shell.content.append(fall);
      }

      app.append(shell.element);
      if (state.activeView === 'jarvis' && jarvisOsLastUi) {
        applyJarvisOsUi(jarvisOsLastUi);
      }

      if (state.pendingScrollToMando && state.activeView === 'jarvis') {
        const runScroll = () => {
          const el = document.getElementById('hnf-mando-principal-v2');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            state.pendingScrollToMando = false;
          }
        };
        requestAnimationFrame(() => requestAnimationFrame(runScroll));
      }
    },
    () => paintGlobalRenderFallback()
  );
};

async function loadViewData() {
  return safeAsync(
    'loadViewData',
    async () => {
      const healthProbe = await probeBackendHealth();
      applyConnectivityFromProbeResult(healthProbe);
      if (!healthProbe.ok) {
        render();
        return false;
      }

      try {
        state.viewData = await viewRegistry[state.activeView].load();
        state.lastSuccessfulFetchAt = new Date().toISOString();
        saveViewCache(state.activeView, state.viewData);
        saveShellMeta({ activeView: state.activeView, lastSuccessfulFetchAt: state.lastSuccessfulFetchAt });
        try {
          const u = getJarvisUnifiedState(state.viewData || {});
          window.__hnfJarvisBoot = {
            startup: buildJarvisStartupSequence(u),
            presence: buildJarvisPresence(u),
            at: state.lastSuccessfulFetchAt,
          };
        } catch {
          window.__hnfJarvisBoot = null;
        }
        try {
          applyIntelNavigationAfterLoad();
          syncSelectedOT();
          syncSelectedFlota();
          recomputeOtEconomicsSaved();
        } catch {
          /* Errores de UI/selección no deben simular caída de API */
        }
        render();
        return true;
      } catch (e) {
        console.warn('[HNF] Carga de vista con error (/health ya OK; se degrada datos)', e);
        state.lastSuccessfulFetchAt = new Date().toISOString();
        if (VIEWS_WITH_UNIFIED_LOAD.has(state.activeView)) {
          try {
            state.viewData = await loadFullOperationalData();
          } catch {
            state.viewData = loadViewCache(state.activeView);
          }
        } else {
          try {
            state.viewData = await viewRegistry[state.activeView].load();
          } catch {
            state.viewData = loadViewCache(state.activeView);
          }
        }
        saveViewCache(state.activeView, state.viewData);
        saveShellMeta({ activeView: state.activeView, lastSuccessfulFetchAt: state.lastSuccessfulFetchAt });
        try {
          const u = getJarvisUnifiedState(state.viewData || {});
          window.__hnfJarvisBoot = {
            startup: buildJarvisStartupSequence(u),
            presence: buildJarvisPresence(u),
            at: state.lastSuccessfulFetchAt,
          };
        } catch {
          window.__hnfJarvisBoot = null;
        }
        try {
          applyIntelNavigationAfterLoad();
          syncSelectedOT();
          syncSelectedFlota();
          recomputeOtEconomicsSaved();
        } catch {
          /* ignore */
        }
        render();
        return true;
      }
    },
    async () => {
      const probe = await probeBackendHealth();
      applyConnectivityFromProbeResult(probe);
      try {
        render();
      } catch {
        paintGlobalRenderFallback();
      }
      return false;
    }
  );
}

const viewIdFromLocation = () => {
  const h = (typeof window !== 'undefined' && window.location.hash ? window.location.hash : '')
    .replace(/^#\/?/, '')
    .trim();
  const seg = h.split('/')[0].split('?')[0];
  let mapped = seg === 'dashboard' ? 'jarvis' : seg;
  if (mapped === 'jarvis-intake') mapped = 'bandeja-canal';
  if (mapped === 'flujo-operativo-unificado' || mapped === 'control-operativo-tiempo-real') {
    mapped = 'jarvis';
  }
  return mapped && viewRegistry[mapped] ? mapped : null;
};

const operatorRoleBoot = resolveOperatorRole();
const hashedRoute = viewIdFromLocation();
let bootView =
  hashedRoute && isViewAllowedForRole(operatorRoleBoot, hashedRoute)
    ? hashedRoute
    : null;
if (!bootView) {
  bootView = defaultViewForRole(operatorRoleBoot);
}
state.activeView = bootView;
if (hashedRoute && bootView !== hashedRoute && typeof history !== 'undefined' && history.replaceState) {
  try {
    history.replaceState(null, '', `#/${bootView}`);
  } catch {
    /* ignore */
  }
}
if (typeof window !== 'undefined') {
  const rawSeg = (window.location.hash || '').replace(/^#\/?/, '').split('/')[0].split('?')[0];
  if (rawSeg === 'control-operativo-tiempo-real' || rawSeg === 'flujo-operativo-unificado') {
    state.pendingScrollToMando = true;
    const legacyTarget = isViewAllowedForRole(operatorRoleBoot, 'jarvis')
      ? 'jarvis'
      : defaultViewForRole(operatorRoleBoot);
    state.activeView = legacyTarget;
    if (legacyTarget !== 'jarvis') state.pendingScrollToMando = false;
    try {
      if (history.replaceState) history.replaceState(null, '', `#/${legacyTarget}`);
    } catch {
      /* ignore */
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const v = viewIdFromLocation();
    if (v && v !== state.activeView) {
      navigateToView(v);
    }
  });
  window.addEventListener('hnf-jarvis-evo', () => {
    try {
      if (state.activeView === 'jarvis') render();
    } catch {
      /* ignore */
    }
  });
  window.HNFJarvisPulse?.startJarvisEvolutionAutoloop?.({ intervalMs: 300_000, kickoff: true });
}

state.integrationStatus = 'cargando';
try {
  render();
} catch (bootRenderErr) {
  console.error('[HNF] render de arranque', bootRenderErr);
}

loadViewData()
  .then(() => {
    try {
      startJarvisAutonomicSurface({ getViewData: () => state.viewData });
      const pushJarvisOsUi = (data) => {
        jarvisOsLastUi = data;
        registerJarvisOsMemory({ presence: data.presence, decision: data.decision });
        applyJarvisOsUi(data);
      };
      const s0 = getJarvisOsMergedState();
      pushJarvisOsUi({
        presence: jarvisOsBuildPresence(s0),
        decision: jarvisOsBuildDecision(s0),
      });
      startJarvisAutonomousLoop(() => getJarvisOsMergedState(), pushJarvisOsUi);
      startJarvisConsciousLoop({
        getMergedState: getJarvisOsMergedState,
        getViewData: () => state.viewData,
      });
      if (typeof window !== 'undefined') {
        window.HNFJarvisConscious = { notifyExternalEvent: notifyJarvisExternalEvent };
      }
    } catch (bootErr) {
      console.error('[HNF] post-load bootstrap', bootErr);
    }
  })
  .catch(async (e) => {
    console.error('[HNF] promesa loadViewData rechazada', e);
    const probe = await probeBackendHealth();
    applyConnectivityFromProbeResult(probe);
    try {
      render();
    } catch {
      paintGlobalRenderFallback();
    }
  });