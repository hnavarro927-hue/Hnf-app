/**
 * Centro de mando Jarvis — estructura visual nueva (.hnf-ai-*).
 * Datos y navegación iguales; DOM mínimo sin capas legacy.
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { buildJarvisLiveOrbitModel } from '../domain/hnf-jarvis-live-orbit.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';

function orbitTone(badge, { crit = 5, warn = 1 } = {}) {
  const n = Number(badge) || 0;
  if (n >= crit) return 'crit';
  if (n >= warn) return 'warn';
  return 'ok';
}

function toneFromCounts(bloqueos, pendientes) {
  if (bloqueos > 0) return 'crit';
  if (pendientes > 0) return 'warn';
  return 'ok';
}

function ctaFromAccion(s) {
  const u = String(s || '')
    .trim()
    .slice(0, 24);
  return u || 'Ejecutar';
}

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

/** Un solo listener global: la franja dispara el último handler del mando montado. */
let __hnfJarvisPrimaryActionFn = null;
if (typeof window !== 'undefined' && !window.__hnfJarvisPrimaryActionWired) {
  window.__hnfJarvisPrimaryActionWired = true;
  window.addEventListener('hnf-jarvis-primary-action', () => {
    if (typeof __hnfJarvisPrimaryActionFn === 'function') __hnfJarvisPrimaryActionFn();
  });
}

/**
 * @param {object} p
 * @param {object} p.data
 * @param {Function} [p.intelNavigate]
 * @param {Function} [p.navigateToView]
 * @param {Function} [p.reloadApp]
 */
export function createHnfMandoPrincipalV2({
  data,
  liveCmdModel: _liveCmdModel,
  board: _board,
  intelNavigate,
  navigateToView,
  reloadApp,
}) {
  const raw = data || {};
  const adn = raw.hnfAdn && typeof raw.hnfAdn === 'object' ? raw.hnfAdn : buildHnfAdnSnapshot(raw);
  const { bloqueos, pendientes, ok } = adn.traffic;

  let live = adn.jarvisLiveOrbit;
  if (!live || typeof live !== 'object') {
    live = buildJarvisLiveOrbitModel(raw, {
      eventosUnificados: adn.eventosUnificados,
      cards: adn.cards,
      alertas: adn.alertas,
      traffic: adn.traffic,
      bottleneck: adn.bottleneck,
      whatsappHoy: adn.whatsappHoy,
      dineroEnRiesgo: adn.dineroEnRiesgo,
      principalProblema: adn.principalProblema,
      hnfCoreSolicitudStats: adn.hnfCoreSolicitudStats,
    });
  }
  const nucleo = live.nucleo || {};
  const commercialLive = adn.commercialLive || live.commercialLive || {};

  const wrap = document.createElement('section');
  wrap.className = 'hnf-ai-panel';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Centro de mando Jarvis');

  const stage = document.createElement('div');
  stage.className = 'hnf-ai-stage';

  const o = adn.orbits || {};
  const climaTone = toneFromCounts(bloqueos, pendientes);
  const climaInd =
    bloqueos > 0 ? `${bloqueos} crít.` : pendientes > 0 ? `${pendientes} atención` : `${ok} OK`;

  const flotaN = Number(o.flota?.badge) || 0;
  const planN = Number(o.planificacion?.badge) || 0;
  const comN = Number(o.comercial?.badge) || 0;
  const ctrlN = Number(o.control?.badge) || 0;

  const comIndShort = (() => {
    const a = commercialLive.oportunidadesAbiertas ?? 0;
    const c = commercialLive.cotizacionesPendientes ?? 0;
    if (a + c > 0) return `${a} opp · ${c} cot.`;
    return comN ? `${comN}` : '—';
  })();

  const mkSat = (slot, def, toneKey, summary, person) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hnf-ai-sat hnf-ai-sat--${slot} hnf-ai-sat--${toneKey}`;
    btn.setAttribute('aria-label', `${def.label}. ${summary}. ${person}`);
    const lab = document.createElement('span');
    lab.className = 'hnf-ai-sat__label';
    lab.textContent = def.label;
    const sig = document.createElement('span');
    sig.className = 'hnf-ai-sat__sig';
    sig.textContent = summary;
    const own = document.createElement('span');
    own.className = 'hnf-ai-sat__person';
    own.textContent = person;
    const go = document.createElement('span');
    go.className = 'hnf-ai-sat__go';
    go.textContent = 'Entrar';
    btn.append(lab, sig, own, go);
    btn.addEventListener('click', () => navigateToView?.(def.view));
    return btn;
  };

  const sPlan = mkSat(
    'plan',
    o.planificacion || { label: 'Planificación', view: 'planificacion' },
    orbitTone(planN, { crit: 4, warn: 1 }),
    planN ? `${planN} señal` : 'OK',
    'Equipo'
  );
  const sFlota = mkSat(
    'flota',
    o.flota || { label: 'Flota', view: 'flota' },
    orbitTone(flotaN, { crit: 4, warn: 1 }),
    flotaN ? `${flotaN} activo` : '—',
    'Gery'
  );
  const sClima = mkSat(
    'clima',
    o.clima || { label: 'Clima', view: 'clima' },
    climaTone,
    climaInd,
    'Romina'
  );
  const sCom = mkSat(
    'com',
    o.comercial || { label: 'Comercial', view: 'oportunidades' },
    orbitTone(comN, { crit: 8, warn: 3 }),
    comIndShort,
    'Comercial'
  );
  const sCtrl = mkSat(
    'ctrl',
    o.control || { label: 'Control', view: 'control-gerencial' },
    orbitTone(ctrlN, { crit: 5, warn: 1 }),
    ctrlN ? `${ctrlN} evt` : '—',
    'Lyn'
  );

  const coreWrap = document.createElement('div');
  coreWrap.className = 'hnf-ai-core';
  coreWrap.setAttribute('aria-label', 'Núcleo operativo');

  const halo = document.createElement('div');
  halo.className = 'hnf-ai-core__halo';
  halo.setAttribute('aria-hidden', 'true');

  const disc = document.createElement('div');
  disc.className = 'hnf-ai-core__disc';

  const brand = document.createElement('span');
  brand.className = 'hnf-ai-core__brand';
  brand.textContent = 'JARVIS';

  const focus = document.createElement('p');
  focus.className = 'hnf-ai-core__focus';
  focus.textContent = truncate(nucleo.problemaPrincipal || adn.principalProblema || 'Operación en curso.', 72);

  const metric = document.createElement('p');
  metric.className = 'hnf-ai-core__metric';
  const riskFmt = nucleo.dineroRiesgoFmt || (adn.dineroEnRiesgo ? `~$${Math.round(adn.dineroEnRiesgo).toLocaleString('es-CL')}` : '—');
  metric.textContent = `Riesgo operativo: ${riskFmt}`;

  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.id = 'hnf-ejecutar-propuesta-mando';
  btnExec.className = 'hnf-ai-core__cta';
  btnExec.textContent = ctaFromAccion(nucleo.siguienteAccion || adn.recomendacion);
  btnExec.setAttribute('aria-label', 'Ejecutar siguiente paso sugerido');
  const runExec = () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  };
  btnExec.addEventListener('click', runExec);
  __hnfJarvisPrimaryActionFn = runExec;

  disc.append(brand, focus, metric, btnExec);
  coreWrap.append(halo, disc);

  stage.append(sPlan, sFlota, sClima, sCom, sCtrl, coreWrap);

  const foot = document.createElement('div');
  foot.className = 'hnf-ai-panel__foot';
  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'hnf-ai-panel__sync';
  sync.textContent = 'Actualizar datos';
  sync.setAttribute('aria-label', 'Sincronizar datos');
  sync.addEventListener('click', async () => {
    sync.disabled = true;
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      sync.disabled = false;
    }
  });
  foot.append(sync);

  wrap.append(stage, foot);
  return wrap;
}
