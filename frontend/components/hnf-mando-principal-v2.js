/**
 * Jarvis Live Orbit v3 — una decisión: problema, riesgo, bloqueos, comercial en núcleo, acción en botón.
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import {
  buildConicEntradaGradient,
  buildConicFlujoGradient,
  buildJarvisLiveOrbitModel,
} from '../domain/hnf-jarvis-live-orbit.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';
import { getControlState, setMode } from '../domain/jarvis-control-center.js';

/** WhatsApp · Correo · Manual · Comercial */
const RGB_ENTRADA = ['0,194,168', '59,130,246', '148,163,184', '251,191,36'];

function toneFromCounts(bloqueos, pendientes) {
  if (bloqueos > 0) return { label: 'ALERTA', mod: 'crit' };
  if (pendientes > 0) return { label: 'ALERTA', mod: 'warn' };
  return { label: 'OK', mod: 'ok' };
}

function orbitTone(badge, { crit = 5, warn = 1 } = {}) {
  const n = Number(badge) || 0;
  if (n >= crit) return { label: 'ALERTA', mod: 'crit' };
  if (n >= warn) return { label: 'ALERTA', mod: 'warn' };
  return { label: 'OK', mod: 'ok' };
}

function ctaFromAccion(s) {
  const u = String(s || '')
    .trim()
    .toUpperCase();
  if (u.length <= 28) return u || 'RESOLVER';
  return `${u.slice(0, 26)}…`;
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
    });
  }
  const nucleo = live.nucleo || {};
  const commercialLive = adn.commercialLive || live.commercialLive || {};

  const wrap = document.createElement('section');
  wrap.className = 'hnf-command-deck hnf-jarvis-live-orbit hnf-jarvis-live-orbit--v3';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Jarvis Live Orbit v3');

  const field = document.createElement('div');
  field.className = 'hnf-command-deck__orbit-field';

  const mkOrbit = (slot, o, tone, indicator, owner) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hnf-orbit-card hnf-orbit-card--${tone.mod} hnf-orbit-card--${slot} hnf-orbit-card--live`;
    btn.setAttribute('aria-label', `${o.label}: ${tone.label}. ${indicator}`);
    const nm = document.createElement('span');
    nm.className = 'hnf-orbit-card__name';
    nm.textContent = o.label;
    const st = document.createElement('span');
    st.className = `hnf-orbit-card__estado hnf-orbit-card__estado--${tone.mod}`;
    st.textContent = tone.label;
    const own = document.createElement('span');
    own.className = 'hnf-orbit-card__owner';
    own.textContent = owner || '—';
    const dot = document.createElement('span');
    dot.className = `hnf-orbit-card__pulse hnf-orbit-card__pulse--${tone.mod}`;
    dot.setAttribute('aria-hidden', 'true');
    const ind = document.createElement('span');
    ind.className = 'hnf-orbit-card__crit';
    ind.textContent = indicator;
    const go = document.createElement('span');
    go.className = 'hnf-orbit-card__go';
    go.textContent = 'Entrar';
    btn.append(nm, st, own, dot, ind, go);
    btn.addEventListener('click', () => navigateToView?.(o.view));
    return btn;
  };

  const o = adn.orbits || {};
  const climaTone = toneFromCounts(bloqueos, pendientes);
  const climaInd =
    bloqueos > 0 ? `${bloqueos} bloqueos` : pendientes > 0 ? `${pendientes} pendientes` : `${ok} OT OK`;

  const flotaN = Number(o.flota?.badge) || 0;
  const planN = Number(o.planificacion?.badge) || 0;
  const comN = Number(o.comercial?.badge) || 0;
  const ctrlN = Number(o.control?.badge) || 0;

  const comIndShort = (() => {
    const a = commercialLive.oportunidadesAbiertas ?? 0;
    const c = commercialLive.cotizacionesPendientes ?? 0;
    if (a + c > 0) return `${a} opp. · ${c} cotiz.`;
    return comN ? `Radar ${comN}` : 'Sin presión';
  })();

  const orbitPlan = mkOrbit(
    'plan',
    o.planificacion || { label: 'Planificación', view: 'planificacion' },
    orbitTone(planN, { crit: 4, warn: 1 }),
    planN ? `${planN} alertas` : 'Calendario OK',
    'Equipo'
  );
  const orbitFlota = mkOrbit(
    'flota',
    o.flota || { label: 'Flota', view: 'flota' },
    orbitTone(flotaN, { crit: 4, warn: 1 }),
    flotaN ? `${flotaN} en curso` : 'Sin cola',
    'Gery'
  );
  const orbitClima = mkOrbit(
    'clima',
    o.clima || { label: 'Clima', view: 'clima' },
    climaTone,
    climaInd,
    'Romina'
  );
  const orbitCom = mkOrbit(
    'com',
    o.comercial || { label: 'Comercial', view: 'oportunidades' },
    orbitTone(comN, { crit: 8, warn: 3 }),
    comIndShort,
    'Comercial'
  );
  const orbitCtrl = mkOrbit(
    'ctrl',
    o.control || { label: 'Control', view: 'control-gerencial' },
    orbitTone(ctrlN, { crit: 5, warn: 1 }),
    ctrlN ? `${ctrlN} eventos` : 'Sin eventos',
    'Lyn'
  );

  const nucleus = document.createElement('div');
  nucleus.className = 'hnf-command-nucleus';
  nucleus.setAttribute('aria-label', 'Jarvis · decisión del día');

  const rings = document.createElement('div');
  rings.className = 'hnf-command-nucleus__rings';

  const glow = document.createElement('span');
  glow.className = 'hnf-command-nucleus__live-glow';
  glow.setAttribute('aria-hidden', 'true');

  const sweep = document.createElement('span');
  sweep.className = 'hnf-command-nucleus__radar-sweep hnf-command-nucleus__radar-sweep--v3';
  sweep.setAttribute('aria-hidden', 'true');

  const arc = document.createElement('span');
  arc.className = 'hnf-command-nucleus__radar-arc';
  arc.setAttribute('aria-hidden', 'true');

  const ringOut = document.createElement('div');
  ringOut.className = 'hnf-live-ring hnf-live-ring--entrada';
  ringOut.title = 'Origen: WhatsApp · Correo · Manual · Comercial';
  const entInt = live.ringEntrada?.intensities || [0.25, 0.25, 0.25, 0.25];
  ringOut.style.background = buildConicEntradaGradient(entInt, RGB_ENTRADA);

  const ringIn = document.createElement('div');
  ringIn.className = 'hnf-live-ring hnf-live-ring--flujo';
  ringIn.title =
    'Flujo: Ingreso → Clasificación → Asignación → Ejecución → Evidencia → Cierre → Cobro';
  ringIn.style.background = buildConicFlujoGradient(live.ringFlujo || { estados: [], stress: [] });

  const trackOut = document.createElement('span');
  trackOut.className = 'hnf-command-nucleus__ring-track hnf-command-nucleus__ring-track--outer';
  trackOut.setAttribute('aria-hidden', 'true');
  const trackIn = document.createElement('span');
  trackIn.className = 'hnf-command-nucleus__ring-track hnf-command-nucleus__ring-track--inner';
  trackIn.setAttribute('aria-hidden', 'true');

  rings.append(glow, sweep, arc, trackOut, ringOut, trackIn, ringIn);

  const core = document.createElement('div');
  core.className = 'hnf-command-nucleus__core hnf-command-nucleus__core--live hnf-command-nucleus__core--v3';

  const kick = document.createElement('span');
  kick.className = 'hnf-command-nucleus__kick hnf-command-nucleus__kick--live';
  kick.textContent = 'JARVIS LIVE';

  const problema = document.createElement('p');
  problema.className = 'hnf-command-nucleus__v3-problem';
  problema.textContent = String(nucleo.problemaPrincipal || adn.principalProblema || '—')
    .toUpperCase()
    .slice(0, 100);

  const riesgo = document.createElement('p');
  riesgo.className = 'hnf-command-nucleus__v3-risk';
  riesgo.textContent = `${nucleo.dineroRiesgoFmt || '—'} EN RIESGO`;

  const bloq = document.createElement('p');
  bloq.className = 'hnf-command-nucleus__v3-block';
  bloq.textContent = String(nucleo.otBloqueadasLine || `${bloqueos} OT BLOQUEADAS`).toUpperCase();

  const comLine = document.createElement('p');
  comLine.className = 'hnf-command-nucleus__v3-com';
  comLine.textContent = String(nucleo.comercialIntegrado || 'COM. —').toUpperCase().slice(0, 72);

  const cruce = document.createElement('p');
  cruce.className = 'hnf-command-nucleus__v3-unify';
  cruce.textContent = String(nucleo.cruceOperativo || '').toUpperCase().slice(0, 80);

  const resp = document.createElement('p');
  resp.className = 'hnf-command-nucleus__v3-who';
  resp.textContent = `→ ${String(nucleo.responsableSugerido || '—').slice(0, 28)}`;

  const modeRow = document.createElement('div');
  modeRow.className = 'hnf-command-nucleus__mode';
  modeRow.setAttribute('role', 'group');
  modeRow.setAttribute('aria-label', 'Modo operación');
  const modeMap = [
    { key: 'autonomic_safe', label: 'Auto' },
    { key: 'assist', label: 'Asistido' },
    { key: 'observe', label: 'Manual' },
  ];
  const syncModeUi = () => {
    const { jarvisMode } = getControlState();
    const effective = jarvisMode === 'off' ? 'observe' : jarvisMode;
    modeRow.querySelectorAll('.hnf-mode-chip').forEach((el) => {
      const k = el.getAttribute('data-mode');
      el.classList.toggle('hnf-mode-chip--on', k === effective);
    });
  };
  for (const m of modeMap) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-mode-chip';
    b.dataset.mode = m.key;
    b.textContent = m.label;
    b.addEventListener('click', () => {
      setMode(m.key);
      syncModeUi();
    });
    modeRow.append(b);
  }
  syncModeUi();

  const accionTxt = nucleo.siguienteAccion || 'RESOLVER';
  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.id = 'hnf-ejecutar-propuesta-mando';
  btnExec.className = 'primary-button hnf-command-nucleus__cta hnf-command-nucleus__cta--resolve hnf-command-nucleus__cta--v3';
  btnExec.textContent = ctaFromAccion(accionTxt);
  btnExec.setAttribute('aria-label', `Ejecutar: ${accionTxt}`);
  btnExec.addEventListener('click', () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  });

  core.append(kick, problema, riesgo, bloq, comLine, cruce, resp, modeRow, btnExec);
  nucleus.append(rings, core);

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
