/**
 * Vista Jarvis (#/jarvis)
 * — Conectado: solo layout premium (`hnf-jarvis-premium.js`). Sin legado UI.
 * — Sin conexión: stub mínimo informativo.
 */

import {
  buildJarvisDailyBrief,
  computeJarvisExecutiveAlerts,
  getJarvisUnifiedState,
} from '../domain/jarvis-core.js';
import {
  getJarvisMemorySummary,
  rememberJarvisAlertSeen,
  rememberJarvisBrief,
} from '../domain/jarvis-memory.js';
import { isTabletMode } from '../domain/jarvis-ui.js';
import { getJarvisPulseState } from '../domain/jarvis-pulse-engine.js';
import { buildJarvisLiveBrain } from '../domain/jarvis-live-brain-engine.js';
import { executeJarvisActions } from '../domain/jarvis-action-engine.js';
import { buildJarvisLiveCommandBrief } from '../domain/jarvis-live-command-brief.js';
import { createHnfEnvironmentContinuityPanel } from '../components/hnf-environment-continuity.js';
import { createHnfJarvisPremiumCommand } from '../components/hnf-jarvis-premium.js';
import { getStoredOperatorName } from '../config/operator.config.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

export const jarvisHqView = ({
  data,
  integrationStatus,
  reloadApp,
  intelNavigate,
  lastDataRefreshAt,
  navigateToView,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'jarvis-hq jarvis-hq--command jarvis-hq--premium-route';
  if (isTabletMode()) root.classList.add('jarvis-hq--tablet');

  if (integrationStatus === 'sin conexión') {
    root.classList.add('jarvis-hq--offline-stub');
    const stub = getJarvisUnifiedState(data || {});
    const lbOffline = buildJarvisLiveBrain({ ...stub, hnfIntegrationStatus: 'sin conexión' });
    const off = document.createElement('div');
    off.className = 'integration-banner integration-banner--offline';
    const offTitle = document.createElement('strong');
    offTitle.textContent = 'Sin conexión al servidor.';
    off.append(
      offTitle,
      document.createTextNode(
        ' Jarvis no consolida ERP en vivo; modo agente sigue activo con simulación y presión de carga local.'
      )
    );
    const sim = document.createElement('div');
    sim.className = 'jarvis-cc-sim-ingesta tarjeta';
    const simH = document.createElement('h3');
    simH.className = 'jarvis-cc-sim-ingesta__title';
    simH.textContent = 'Autoingesta simulada — no paralizar comando';
    const simP = document.createElement('p');
    simP.className = 'jarvis-cc-sim-ingesta__lead';
    simP.textContent =
      lbOffline.alertaModoAgente ||
      'Sin backend, igual debés mover ingreso y riesgo con datos pegados o archivos.';
    const simUl = document.createElement('ul');
    simUl.className = 'jarvis-cc-sim-ingesta__ul';
    const ai = lbOffline.autoingestaSimulada;
    if (ai?.activa) {
      for (const line of [
        `Oportunidad perdida estimada (orden de magnitud): ~$${fmtMoney(ai.perdidaOportunidadEstimada)}`,
        `Riesgo operativo estimado: ${ai.riesgoOperativoEstimado}`,
        `Decisión forzada: ${ai.decision}`,
        ai.nota,
      ].filter(Boolean)) {
        const li = document.createElement('li');
        li.textContent = line;
        simUl.append(li);
      }
    }
    const simMuted = document.createElement('p');
    simMuted.className = 'muted small';
    simMuted.textContent =
      'Ciclo agente: revisar flujo de entrada → detectar vacíos → cargar correo / OT / oportunidades en Centro de Ingesta cuando vuelva la red.';
    sim.append(simH, simP, simUl, simMuted);
    const envTechnicalOffline = createHnfEnvironmentContinuityPanel({
      lastDataRefreshAt,
      integrationStatus: 'sin conexión',
    });
    root.append(envTechnicalOffline, off, sim);
    return root;
  }

  const unified = getJarvisUnifiedState(data || {});
  const result = unified;
  const brief = buildJarvisDailyBrief(unified);
  const memorySummary = getJarvisMemorySummary();
  const execPack = computeJarvisExecutiveAlerts(unified, memorySummary);
  const friction = result.jarvisFrictionPressure || {};
  const alienDecision = result.jarvisAlienDecisionCore || {};

  rememberJarvisBrief(brief);
  for (const a of (execPack.alerts || []).slice(0, 6)) {
    rememberJarvisAlertSeen(a);
  }
  executeJarvisActions(alienDecision, { source: 'hq_render' });

  const refresh = async () => {
    if (typeof reloadApp === 'function') await reloadApp();
  };

  const pulseApi =
    typeof window !== 'undefined' && window.HNFJarvisPulse ? window.HNFJarvisPulse : { getJarvisPulseState };
  const pulseSnap = () => (pulseApi.getJarvisPulseState ? pulseApi.getJarvisPulseState() : getJarvisPulseState());

  const liveCmdModel = buildJarvisLiveCommandBrief({
    unified,
    data: data || {},
    alienDecision,
    friction,
    execPack,
    brief,
    operatorName: getStoredOperatorName(),
  });

  if (liveCmdModel.level >= 2) root.classList.add('jarvis-hq--command-critical');
  else if (liveCmdModel.level >= 1) root.classList.add('jarvis-hq--command-pressure');

  root.classList.add('jarvis-hq--premium-shell');
  root.append(
    createHnfJarvisPremiumCommand({
      data: data || {},
      liveCmdModel,
      alienDecision,
      intelNavigate,
      navigateToView,
      reloadApp: refresh,
      getPulseState: pulseSnap,
    })
  );
  return root;
};
