/**
 * Centro de mando operativo — Jarvis decide: problema + impacto + RESOLVER AHORA.
 * Órbitas vivas (color según riesgo). ADN = anillo segmentado con datos reales.
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';

function fmtMoney(n) {
  return Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

/** 0–1 intensidad para segmentos del anillo ADN */
function segmentIntensities(adn) {
  const t = adn.traffic || {};
  const bloqueos = Number(t.bloqueos) || 0;
  const pend = Number(t.pendientes) || 0;
  const tot = Math.max(1, Number(t.totalOt) || 0);
  const ev = Math.min(1, (Number(adn.totalEventosActivos) || 0) / 8);
  const money = Math.min(1, (Number(adn.dineroEnRiesgo) || 0) / 2_000_000);
  const otFlow = Math.min(1, tot / 25);
  const block = Math.min(1, (bloqueos * 2 + pend) / 12);
  const bot = adn.bottleneck && adn.bottleneck.global !== 'verde' ? 0.85 : 0.25;
  return [otFlow, ev, money, block, bot];
}

function toneFromCounts(bloqueos, pendientes) {
  if (bloqueos > 0) return { label: 'CRÍTICO', mod: 'crit' };
  if (pendientes > 0) return { label: 'ALERTA', mod: 'warn' };
  return { label: 'OK', mod: 'ok' };
}

function orbitTone(badge, { crit = 5, warn = 1 } = {}) {
  const n = Number(badge) || 0;
  if (n >= crit) return { label: 'CRÍTICO', mod: 'crit' };
  if (n >= warn) return { label: 'ALERTA', mod: 'warn' };
  return { label: 'OK', mod: 'ok' };
}

/**
 * @param {object} p
 * @param {object} p.data
 * @param {object} p.liveCmdModel
 * @param {object} p.board
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
  const { bloqueos, pendientes, ok, totalOt } = adn.traffic;
  const segs = segmentIntensities(adn);

  const wrap = document.createElement('section');
  wrap.className = 'hnf-command-deck';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Centro de mando HNF');

  const field = document.createElement('div');
  field.className = 'hnf-command-deck__orbit-field';

  const mkOrbit = (slot, o, tone, indicator) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hnf-orbit-card hnf-orbit-card--${tone.mod} hnf-orbit-card--${slot} hnf-orbit-card--live`;
    btn.setAttribute('aria-label', `${o.label}: ${indicator}`);
    const nm = document.createElement('span');
    nm.className = 'hnf-orbit-card__name';
    nm.textContent = o.label;
    const dot = document.createElement('span');
    dot.className = `hnf-orbit-card__pulse hnf-orbit-card__pulse--${tone.mod}`;
    dot.setAttribute('aria-hidden', 'true');
    const ind = document.createElement('span');
    ind.className = 'hnf-orbit-card__crit';
    ind.textContent = indicator;
    const go = document.createElement('span');
    go.className = 'hnf-orbit-card__go';
    go.textContent = 'ABRIR';
    btn.append(nm, dot, ind, go);
    btn.addEventListener('click', () => navigateToView?.(o.view));
    return btn;
  };

  const o = adn.orbits || {};
  const climaTone = toneFromCounts(bloqueos, pendientes);
  const climaInd =
    bloqueos > 0 ? `${bloqueos} bloqueo(s)` : pendientes > 0 ? `${pendientes} pendiente(s)` : `${ok} OT OK`;

  const flotaN = Number(o.flota?.badge) || 0;
  const planN = Number(o.planificacion?.badge) || 0;
  const comN = Number(o.comercial?.badge) || 0;
  const ctrlN = Number(o.control?.badge) || 0;

  const orbitPlan = mkOrbit(
    'plan',
    o.planificacion || { label: 'Plan', view: 'planificacion' },
    orbitTone(planN, { crit: 4, warn: 1 }),
    planN ? `${planN} alerta(s)` : 'Calendario OK'
  );
  const orbitFlota = mkOrbit(
    'flota',
    o.flota || { label: 'Flota', view: 'flota' },
    orbitTone(flotaN, { crit: 4, warn: 1 }),
    flotaN ? `${flotaN} en curso` : 'Sin cola'
  );
  const orbitClima = mkOrbit('clima', o.clima || { label: 'Clima', view: 'clima' }, climaTone, climaInd);
  const orbitCom = mkOrbit(
    'com',
    o.comercial || { label: 'Comercial', view: 'oportunidades' },
    orbitTone(comN, { crit: 6, warn: 2 }),
    comN ? `${comN} en pipeline` : 'Sin ítems'
  );
  const orbitCtrl = mkOrbit(
    'ctrl',
    o.control || { label: 'Control', view: 'control-gerencial' },
    orbitTone(ctrlN, { crit: 5, warn: 1 }),
    ctrlN ? `${ctrlN} evento(s)` : 'Sin eventos'
  );

  const nucleus = document.createElement('div');
  nucleus.className = 'hnf-command-nucleus';
  nucleus.setAttribute('aria-label', 'Jarvis · decisión');

  const ring = document.createElement('div');
  ring.className = 'hnf-command-nucleus__adn-ring';
  const segWrap = document.createElement('div');
  segWrap.className = 'hnf-adn-segments';
  segWrap.setAttribute('aria-hidden', 'true');
  segWrap.title = 'ADN: OT · eventos · ingresos · bloqueos · responsables';
  segs.forEach((inten, i) => {
    segWrap.style.setProperty(`--adn-a${i}`, String(0.28 + inten * 0.72));
  });
  ring.innerHTML =
    '<span class="hnf-command-nucleus__adn-glow"></span><span class="hnf-command-nucleus__adn-track"></span>';
  ring.append(segWrap);

  const core = document.createElement('div');
  core.className = 'hnf-command-nucleus__core';

  const kick = document.createElement('span');
  kick.className = 'hnf-command-nucleus__kick';
  kick.textContent = 'JARVIS';

  const problema = document.createElement('p');
  problema.className = 'hnf-command-nucleus__problem';
  problema.textContent = String(adn.principalProblema || 'Sin foco crítico.').slice(0, 72).toUpperCase();

  const impactWrap = document.createElement('div');
  impactWrap.className = 'hnf-command-nucleus__impact-wrap';
  const impactLab = document.createElement('span');
  impactLab.className = 'hnf-command-nucleus__impact-lab';
  impactLab.textContent = 'IMPACTO';
  const impacto = document.createElement('p');
  impacto.className = 'hnf-command-nucleus__impact';
  impacto.textContent = `$${fmtMoney(adn.dineroEnRiesgo)} · ${bloqueos} bloqueos · ${pendientes} pend. · ${totalOt || 0} OT`;
  impactWrap.append(impactLab, impacto);

  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.id = 'hnf-ejecutar-propuesta-mando';
  btnExec.className = 'primary-button hnf-command-nucleus__cta hnf-command-nucleus__cta--resolve';
  btnExec.textContent = 'RESOLVER AHORA';
  btnExec.addEventListener('click', () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  });

  core.append(kick, problema, impactWrap, btnExec);
  nucleus.append(ring, core);

  field.append(orbitPlan, orbitFlota, orbitClima, orbitCom, orbitCtrl, nucleus);

  const foot = document.createElement('footer');
  foot.className = 'hnf-command-deck__foot';
  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'hnf-command-deck__sync secondary-button';
  sync.textContent = 'Sync';
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

  wrap.append(field, foot);
  return wrap;
}
