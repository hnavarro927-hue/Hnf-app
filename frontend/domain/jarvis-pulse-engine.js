/**
 * Jarvis Pulse Engine — ciclo MAPE periódico sin acciones externas (solo análisis / memoria local).
 */

import { applyJarvisDataToggles, getControlState } from './jarvis-control-center.js';
import { assembleJarvisUnifiedBase, getJarvisUnifiedState, runJarvisAutonomicCycle } from './jarvis-core.js';
import { buildAlienDecisionCore } from './jarvis-alien-intelligence.js';
import { executeJarvisActions } from './jarvis-action-engine.js';
import { buildJarvisFlowIntelligenceFromBase } from './jarvis-flow-intelligence.js';
import {
  jarvisRuntimeGetOperadorPack,
  jarvisRuntimeRecordError,
  jarvisRuntimeRecordPulseState,
  jarvisRuntimeSetOperadorPack,
} from './jarvis-runtime-snapshot.js';
import { buildJarvisOperadorPulsePack, computeOperadorFingerprint } from './jarvis-operador-engine.js';

export const JARVIS_PULSE_VERSION = '2026-03-23';

const ctx = {
  getViewData: () => null,
  getLastDataRefreshAt: () => null,
};

/** @type {ReturnType<typeof setInterval> | null} */
let timerId = null;

/** @type {ReturnType<typeof setInterval> | null} */
let evolutionTimerId = null;

const pulseState = {
  version: JARVIS_PULSE_VERSION,
  running: false,
  intervalMs: 45000,
  modeAware: true,
  /** @type {boolean|undefined} undefined = misma lógica que jarvis-core + toggle */
  persistMemoryOverride: undefined,
  lastCycleAt: null,
  lastCycleKind: null,
  cyclesTotal: 0,
  lightSkips: 0,
  lastFingerprint: null,
  lastError: null,
  lastResultSummary: null,
  onCycleComplete: null,
  jarvisFlowPulse: null,
  jarvisDecisionLayer: null,
  prevOperadorFingerprint: null,
};

export function setJarvisPulseContext(c = {}) {
  if (typeof c.getViewData === 'function') ctx.getViewData = c.getViewData;
  if (typeof c.getLastDataRefreshAt === 'function') ctx.getLastDataRefreshAt = c.getLastDataRefreshAt;
}

function computeFingerprint(viewData) {
  const vd = viewData || {};
  const planOts = vd.planOts ?? vd.ots?.data ?? (Array.isArray(vd.ots) ? vd.ots : []);
  const docs = vd.technicalDocuments || [];
  const opps = vd.commercialOpportunities || [];
  const msgs = vd.outlookFeed?.messages || [];
  const vault = vd.historicalVault?.records || [];
  const cal = vd.operationalCalendar?.entries || [];
  const wa = vd.whatsappFeed?.messages || [];
  const refresh = ctx.getLastDataRefreshAt ? ctx.getLastDataRefreshAt() : null;
  return JSON.stringify({
    o: planOts.length,
    d: docs.length,
    p: opps.length,
    m: msgs.length,
    v: vault.length,
    c: cal.length,
    w: Array.isArray(wa) ? wa.length : 0,
    r: refresh || null,
  });
}

function persistOptionsForCycle(ctrl) {
  if (ctrl.jarvisMode === 'observe') return { persistMemory: false };
  if (pulseState.persistMemoryOverride === true) return { persistMemory: true };
  if (pulseState.persistMemoryOverride === false) return { persistMemory: false };
  return {};
}

function pushAlienOperationalLayerFromViewData(vd) {
  if (!vd) return;
  try {
    const u = getJarvisUnifiedState(vd);
    const core = buildAlienDecisionCore(u);
    executeJarvisActions(core, { source: 'pulse_evolution' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hnf-jarvis-evo', { detail: { at: Date.now() } }));
    }
  } catch (e) {
    jarvisRuntimeRecordError(String(e?.message || e));
  }
}

function syncPulseRuntimeSnapshot() {
  jarvisRuntimeRecordPulseState({
    running: pulseState.running,
    lastCycleAt: pulseState.lastCycleAt,
    lastCycleKind: pulseState.lastCycleKind,
    intervalMs: pulseState.intervalMs,
    lastError: pulseState.lastError,
    lightSkips: pulseState.lightSkips,
  });
}

function refreshPulseFlowLayer(viewData, mapeEnvelope, cicloMeta = {}) {
  const ctrl = getControlState();
  const toggled = applyJarvisDataToggles(viewData || {}, ctrl.jarvisToggles);
  const base = assembleJarvisUnifiedBase(toggled);
  const mapeOk = mapeEnvelope && !mapeEnvelope.skipped ? mapeEnvelope : null;
  const pack = buildJarvisFlowIntelligenceFromBase(base, mapeOk);
  pulseState.jarvisFlowPulse = pack;
  pulseState.jarvisDecisionLayer = pack.jarvisDecisionLayer;

  const operadorPack = buildJarvisOperadorPulsePack(base, mapeOk, pack);
  const fpOp = computeOperadorFingerprint(operadorPack);
  const cambio = Boolean(pulseState.prevOperadorFingerprint && pulseState.prevOperadorFingerprint !== fpOp);
  operadorPack.pulseMeta = {
    ciclo: cicloMeta.ciclo || 'completo',
    operadorCambio: cambio,
    fingerprint: fpOp,
  };
  pulseState.prevOperadorFingerprint = fpOp;
  jarvisRuntimeSetOperadorPack(operadorPack);
}

function runOneCycle(config) {
  const ctrl = getControlState();
  pulseState.lastError = null;

  if (ctrl.jarvisMode === 'off') {
    pulseState.lastCycleKind = 'skipped_mode';
    pulseState.lastCycleAt = Date.now();
    pulseState.lastResultSummary = 'Modo off — pulse no ejecuta MAPE';
    config.onCycleComplete?.({
      kind: 'skipped',
      reason: 'jarvis_mode_off',
      at: pulseState.lastCycleAt,
    });
    syncPulseRuntimeSnapshot();
    return;
  }

  const vd = ctx.getViewData?.();
  if (vd == null) {
    pulseState.lastCycleKind = 'skipped_no_data';
    pulseState.lastCycleAt = Date.now();
    pulseState.lastResultSummary = 'Sin viewData';
    config.onCycleComplete?.({ kind: 'skipped', reason: 'no_view_data', at: pulseState.lastCycleAt });
    syncPulseRuntimeSnapshot();
    return;
  }

  const fp = computeFingerprint(vd);
  const unchanged = config.modeAware !== false && fp === pulseState.lastFingerprint;

  if (unchanged) {
    pulseState.lastFingerprint = fp;
    pulseState.lastCycleAt = Date.now();
    pulseState.lastCycleKind = 'light';
    pulseState.lightSkips += 1;
    pulseState.lastResultSummary = 'Sin cambios relevantes — ciclo liviano (sin MAPE completo)';
    refreshPulseFlowLayer(vd, null);
    config.onCycleComplete?.({
      kind: 'light',
      skippedHeavy: true,
      fingerprint: fp,
      at: pulseState.lastCycleAt,
      jarvisDecisionLayer: pulseState.jarvisDecisionLayer,
    });
    syncPulseRuntimeSnapshot();
    return;
  }

  pulseState.lastFingerprint = fp;
  const result = runJarvisAutonomicCycle(vd, persistOptionsForCycle(ctrl));
  refreshPulseFlowLayer(vd, result?.skipped ? null : result, { ciclo: 'completo' });

  pulseState.lastCycleAt = Date.now();
  pulseState.lastCycleKind = result?.skipped ? 'skipped' : 'full';
  pulseState.cyclesTotal += 1;
  pulseState.lastResultSummary =
    result?.skipped && result.reason === 'jarvis_mode_off'
      ? 'Saltado: modo off'
      : result?.skipped
        ? `Saltado: ${result.reason || '—'}`
        : `MAPE · salud ${result?.systemHealth ?? '—'} · riesgo ${result?.riskLevel ?? '—'}`;

  config.onCycleComplete?.({
    kind: 'full',
    result,
    fingerprint: fp,
    at: pulseState.lastCycleAt,
    jarvisDecisionLayer: pulseState.jarvisDecisionLayer,
  });
  syncPulseRuntimeSnapshot();
}

/**
 * Un ciclo de evolución (MAPE liviano o completo según datos); para modo vida continua o disparo manual.
 * @param {object} [opts]
 * @param {boolean} [opts.modeAware]
 * @param {(payload: object) => void} [opts.onCycleComplete]
 */
export function runJarvisEvolutionLoop(opts = {}) {
  const userCb = typeof opts.onCycleComplete === 'function' ? opts.onCycleComplete : undefined;
  const config = {
    modeAware: opts.modeAware !== false,
    onCycleComplete: (payload) => {
      userCb?.(payload);
      if (opts.skipAlienActions === true) return;
      if (payload?.kind === 'skipped' || payload?.kind === 'error') return;
      const vd = ctx.getViewData?.();
      if (vd) pushAlienOperationalLayerFromViewData(vd);
    },
  };
  try {
    runOneCycle(config);
  } catch (e) {
    pulseState.lastError = String(e?.message || e);
    pulseState.lastCycleAt = Date.now();
    jarvisRuntimeRecordError(pulseState.lastError);
    syncPulseRuntimeSnapshot();
    config.onCycleComplete?.({ kind: 'error', error: pulseState.lastError, at: pulseState.lastCycleAt });
  }
  return getJarvisPulseState();
}

/**
 * Ciclo de evolución cada intervalo (default 5 min), sin depender del botón en HQ.
 */
export function startJarvisEvolutionAutoloop(opts = {}) {
  stopJarvisEvolutionAutoloop();
  if (typeof window === 'undefined') return { intervalMs: 0, running: false };
  const intervalMs = Math.max(60_000, Math.min(3_600_000, Number(opts.intervalMs) || 300_000));
  const tick = () => {
    try {
      runJarvisEvolutionLoop({ skipAlienActions: false });
    } catch (e) {
      jarvisRuntimeRecordError(String(e?.message || e));
    }
  };
  if (opts.kickoff !== false) tick();
  evolutionTimerId = window.setInterval(tick, intervalMs);
  return { intervalMs, running: true };
}

export function stopJarvisEvolutionAutoloop() {
  if (evolutionTimerId != null) {
    clearInterval(evolutionTimerId);
    evolutionTimerId = null;
  }
}

function scheduleNext(config) {
  if (!pulseState.running) return;
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
  timerId = window.setInterval(() => {
    if (!pulseState.running) return;
    const body = () => {
      try {
        runOneCycle(config);
      } catch (e) {
        pulseState.lastError = String(e?.message || e);
        pulseState.lastCycleAt = Date.now();
        jarvisRuntimeRecordError(pulseState.lastError);
        syncPulseRuntimeSnapshot();
        config.onCycleComplete?.({ kind: 'error', error: pulseState.lastError, at: pulseState.lastCycleAt });
      }
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(body, { timeout: Math.min(12000, config.intervalMs) });
    } else {
      body();
    }
  }, config.intervalMs);
}

/**
 * @param {object} [opts]
 * @param {number} [opts.intervalMs]
 * @param {boolean} [opts.modeAware]
 * @param {boolean} [opts.persistMemory]
 * @param {(payload: object) => void} [opts.onCycleComplete]
 */
export function startJarvisPulse(opts = {}) {
  stopJarvisPulse();

  const intervalMs = Math.max(8000, Math.min(600_000, Number(opts.intervalMs) || 45000));
  pulseState.running = true;
  pulseState.intervalMs = intervalMs;
  pulseState.modeAware = opts.modeAware !== false;
  pulseState.persistMemoryOverride =
    typeof opts.persistMemory === 'boolean' ? opts.persistMemory : undefined;
  pulseState.onCycleComplete = typeof opts.onCycleComplete === 'function' ? opts.onCycleComplete : null;
  pulseState.lastError = null;

  const config = {
    intervalMs,
    modeAware: pulseState.modeAware,
    onCycleComplete: pulseState.onCycleComplete,
  };

  const kickoff = () => {
    try {
      runOneCycle(config);
    } catch (e) {
      pulseState.lastError = String(e?.message || e);
    }
    scheduleNext(config);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(kickoff, { timeout: 3000 });
  } else {
    window.setTimeout(kickoff, 400);
  }

  return getJarvisPulseState();
}

export function stopJarvisPulse() {
  pulseState.running = false;
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
  return getJarvisPulseState();
}

export function getJarvisPulseState() {
  const opPack = jarvisRuntimeGetOperadorPack();
  return {
    ...pulseState,
    secondsSinceLastCycle:
      pulseState.lastCycleAt != null ? Math.max(0, Math.round((Date.now() - pulseState.lastCycleAt) / 1000)) : null,
    operadorCambio: Boolean(opPack?.pulseMeta?.operadorCambio),
    operadorCicloPulse: opPack?.pulseMeta?.ciclo ?? null,
  };
}

export function getHNFJarvisPulseApi() {
  return {
    startJarvisPulse,
    stopJarvisPulse,
    getJarvisPulseState,
    setJarvisPulseContext,
    runJarvisEvolutionLoop,
    startJarvisEvolutionAutoloop,
    stopJarvisEvolutionAutoloop,
  };
}
