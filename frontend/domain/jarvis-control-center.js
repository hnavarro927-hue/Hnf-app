/**
 * Control maestro Jarvis — modos y toggles de ingesta (localStorage).
 * No toca backend productivo.
 */

const LS_CONTROL = 'hnf_jarvis_control_center_v1';
const LS_FROZEN_UNIFIED = 'hnf_jarvis_frozen_unified_v1';

const DEFAULTS = {
  jarvisMode: 'observe',
  /** Si true, Jarvis puede ejecutar acciones de riesgo bajo sin clic (fase autonomía). Por defecto siempre false. */
  jarvisAutonomiaEjecucion: false,
  jarvisToggles: {
    ingestCurrentData: true,
    ingestOutlook: false,
    ingestVault: false,
    ingestDocuments: true,
    ingestCommercial: true,
    ingestCalendar: true,
    ingestWhatsapp: false,
    persistMapeMemory: false,
    showExperimentalSignals: false,
  },
};

const readJson = (key, fb) => {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fb;
  } catch {
    return fb;
  }
};

const writeJson = (key, v) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

function deepMergeToggles(stored) {
  const t = { ...DEFAULTS.jarvisToggles, ...(stored?.jarvisToggles || {}) };
  return t;
}

/**
 * Estado completo persistido + derivados.
 */
export function getControlState() {
  const stored = readJson(LS_CONTROL, {});
  const jarvisMode = ['off', 'observe', 'assist', 'autonomic_safe'].includes(stored.jarvisMode)
    ? stored.jarvisMode
    : DEFAULTS.jarvisMode;
  const jarvisToggles = deepMergeToggles(stored);
  const jarvisAutonomiaEjecucion = Boolean(stored.jarvisAutonomiaEjecucion);
  return {
    jarvisMode,
    jarvisToggles,
    jarvisAutonomiaEjecucion,
    modeLabel: modeToLabel(jarvisMode),
    updatedAt: stored.updatedAt || null,
  };
}

function modeToLabel(mode) {
  const m = {
    off: 'Apagado (último snapshot)',
    observe: 'Observación — análisis sin CTAs activas',
    assist: 'Asistido — tareas y navegación sugerida',
    autonomic_safe: 'Autónomo seguro — plan MAPE local, sin ERP',
  };
  return m[mode] || mode;
}

export function getMode() {
  return getControlState().jarvisMode;
}

export function setMode(mode) {
  if (!['off', 'observe', 'assist', 'autonomic_safe'].includes(mode)) return getControlState();
  const cur = readJson(LS_CONTROL, {});
  const next = { ...cur, jarvisMode: mode, updatedAt: new Date().toISOString() };
  writeJson(LS_CONTROL, next);
  return getControlState();
}

export function getToggles() {
  return { ...getControlState().jarvisToggles };
}

export function setToggle(key, value) {
  const allowed = Object.keys(DEFAULTS.jarvisToggles);
  if (!allowed.includes(key)) return getToggles();
  const cur = readJson(LS_CONTROL, {});
  const toggles = deepMergeToggles(cur);
  toggles[key] = Boolean(value);
  writeJson(LS_CONTROL, {
    ...cur,
    jarvisToggles: toggles,
    updatedAt: new Date().toISOString(),
  });
  return getToggles();
}

export function resetToSafeDefaults() {
  writeJson(LS_CONTROL, {
    jarvisMode: DEFAULTS.jarvisMode,
    jarvisAutonomiaEjecucion: DEFAULTS.jarvisAutonomiaEjecucion,
    jarvisToggles: { ...DEFAULTS.jarvisToggles },
    updatedAt: new Date().toISOString(),
  });
  return getControlState();
}

export function getJarvisAutonomiaEjecucion() {
  return Boolean(readJson(LS_CONTROL, {}).jarvisAutonomiaEjecucion);
}

/** Activa ejecución automática solo para propuestas de riesgo bajo (cuando el motor lo permita). */
export function setJarvisAutonomiaEjecucion(enabled) {
  const cur = readJson(LS_CONTROL, {});
  writeJson(LS_CONTROL, {
    ...cur,
    jarvisAutonomiaEjecucion: Boolean(enabled),
    updatedAt: new Date().toISOString(),
  });
  return getJarvisAutonomiaEjecucion();
}

/**
 * Aplica toggles a viewData antes de ensamblar Intel / MAPE.
 */
export function applyJarvisDataToggles(viewData, toggles) {
  const vd = { ...(viewData || {}) };
  const t = toggles || DEFAULTS.jarvisToggles;

  if (!t.ingestCurrentData) {
    return {
      ...vd,
      planOts: [],
      ots: { data: [] },
      technicalDocuments: [],
      technicalDocumentAlerts: [],
      commercialOpportunities: [],
      commercialOpportunityAlerts: [],
      operationalCalendar: { entries: [] },
      operationalCalendarAlerts: [],
      planMantenciones: [],
      outlookFeed: { messages: [], historicalImports: [], ingestErrors: [] },
      whatsappFeed: null,
      historicalVault: { records: [], importBatches: [], computed: null },
    };
  }

  if (!t.ingestOutlook) {
    vd.outlookFeed = {
      ...(typeof vd.outlookFeed === 'object' ? vd.outlookFeed : {}),
      messages: [],
    };
  }
  if (!t.ingestVault) {
    vd.historicalVault = { records: [], importBatches: [], computed: null };
  }
  if (!t.ingestDocuments) {
    vd.technicalDocuments = [];
    vd.technicalDocumentAlerts = [];
  }
  if (!t.ingestCommercial) {
    vd.commercialOpportunities = [];
    vd.commercialOpportunityAlerts = [];
  }
  if (!t.ingestCalendar) {
    vd.operationalCalendar = { entries: [] };
    vd.operationalCalendarAlerts = [];
    vd.planMantenciones = [];
  }
  if (!t.ingestWhatsapp) {
    vd.whatsappFeed = null;
  }

  return vd;
}

export function saveJarvisFrozenUnifiedSnapshot(unified) {
  if (!unified || typeof unified !== 'object') return;
  try {
    const slim = JSON.parse(
      JSON.stringify(unified, (k, v) => {
        if (k === 'liveIngestion' && v && typeof v === 'object') return undefined;
        return v;
      })
    );
    writeJson(LS_FROZEN_UNIFIED, { savedAt: new Date().toISOString(), unified: slim });
  } catch {
    /* ignore quota / circular */
  }
}

export function loadJarvisFrozenUnifiedSnapshot() {
  const row = readJson(LS_FROZEN_UNIFIED, null);
  if (!row?.unified) return null;
  return row.unified;
}

export function getHNFJarvisControlApi() {
  return {
    getMode,
    setMode,
    getToggles,
    setToggle,
    getControlState,
    resetToSafeDefaults,
    saveJarvisFrozenUnifiedSnapshot,
    loadJarvisFrozenUnifiedSnapshot,
  };
}
