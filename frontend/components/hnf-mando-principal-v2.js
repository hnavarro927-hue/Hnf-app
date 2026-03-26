/**
 * Jarvis Live Orbit — núcleo holográfico operativo: doble anillo (origen + flujo) + decisión ejecutiva.
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import {
  buildConicEntradaGradient,
  buildConicFlujoGradient,
  buildJarvisLiveOrbitModel,
} from '../domain/hnf-jarvis-live-orbit.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';

const RGB_ENTRADA = ['0,194,168', '58,134,255', '251,191,36', '248,113,113', '123,97,255'];

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
    });
  }
  const nucleo = live.nucleo || {};
  const commercialLive = adn.commercialLive || live.commercialLive || {};

  const wrap = document.createElement('section');
  wrap.className = 'hnf-command-deck hnf-jarvis-live-orbit';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Jarvis Live Orbit · mando HNF');

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

  const comIndShort = (() => {
    const a = commercialLive.oportunidadesAbiertas ?? 0;
    const c = commercialLive.cotizacionesPendientes ?? 0;
    const r = commercialLive.clientesRepetidos ?? 0;
    if (a + c + r > 0) return `${a} opp. · ${c} cotiz. · ${r} cli. rep.`;
    return comN ? `${comN} en radar` : 'Radar OK';
  })();

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
    orbitTone(comN, { crit: 8, warn: 3 }),
    comIndShort
  );
  const orbitCtrl = mkOrbit(
    'ctrl',
    o.control || { label: 'Control', view: 'control-gerencial' },
    orbitTone(ctrlN, { crit: 5, warn: 1 }),
    ctrlN ? `${ctrlN} evento(s)` : 'Sin eventos'
  );

  const nucleus = document.createElement('div');
  nucleus.className = 'hnf-command-nucleus';
  nucleus.setAttribute('aria-label', 'Jarvis Live · núcleo operativo');

  const rings = document.createElement('div');
  rings.className = 'hnf-command-nucleus__rings';

  const glow = document.createElement('span');
  glow.className = 'hnf-command-nucleus__live-glow';
  glow.setAttribute('aria-hidden', 'true');

  const sweep = document.createElement('span');
  sweep.className = 'hnf-command-nucleus__radar-sweep';
  sweep.setAttribute('aria-hidden', 'true');

  const ringOut = document.createElement('div');
  ringOut.className = 'hnf-live-ring hnf-live-ring--entrada';
  ringOut.title = 'Origen: WA · manual · comercial · seguimiento · cierre';
  const entInt = live.ringEntrada?.intensities || [0.3, 0.3, 0.3, 0.3, 0.3];
  ringOut.style.background = buildConicEntradaGradient(entInt, RGB_ENTRADA);

  const ringIn = document.createElement('div');
  ringIn.className = 'hnf-live-ring hnf-live-ring--flujo';
  ringIn.title = 'Flujo: ingreso → cobro (color = fricción)';
  ringIn.style.background = buildConicFlujoGradient(live.ringFlujo || { estados: [], stress: [] });

  const trackOut = document.createElement('span');
  trackOut.className = 'hnf-command-nucleus__ring-track hnf-command-nucleus__ring-track--outer';
  trackOut.setAttribute('aria-hidden', 'true');
  const trackIn = document.createElement('span');
  trackIn.className = 'hnf-command-nucleus__ring-track hnf-command-nucleus__ring-track--inner';
  trackIn.setAttribute('aria-hidden', 'true');

  rings.append(glow, sweep, trackOut, ringOut, trackIn, ringIn);

  const core = document.createElement('div');
  core.className = 'hnf-command-nucleus__core hnf-command-nucleus__core--live';

  const kick = document.createElement('span');
  kick.className = 'hnf-command-nucleus__kick hnf-command-nucleus__kick--live';
  kick.textContent = 'JARVIS LIVE';

  const presion = document.createElement('p');
  presion.className = 'hnf-command-nucleus__live-line hnf-command-nucleus__live-line--pressure';
  presion.textContent = String(nucleo.lineaPresion || adn.principalProblema || '—')
    .toUpperCase()
    .slice(0, 96);

  const metrics = document.createElement('p');
  metrics.className = 'hnf-command-nucleus__live-line hnf-command-nucleus__live-line--metrics';
  metrics.textContent = String(nucleo.cantidadReal || `${totalOt || 0} OT`).slice(0, 120);

  const opHoy = document.createElement('p');
  opHoy.className = 'hnf-command-nucleus__live-line hnf-command-nucleus__live-line--sub';
  opHoy.textContent = String(nucleo.operacionHoy || '').slice(0, 88);

  const solHoy = document.createElement('p');
  solHoy.className = 'hnf-command-nucleus__live-line hnf-command-nucleus__live-line--sub';
  solHoy.textContent = String(nucleo.solicitudesHoy || '').slice(0, 88);

  const impacto = document.createElement('p');
  impacto.className = 'hnf-command-nucleus__impact hnf-command-nucleus__impact--compact';
  impacto.textContent = String(nucleo.impactoLine || '').slice(0, 96);

  const accion = document.createElement('p');
  accion.className = 'hnf-command-nucleus__live-line hnf-command-nucleus__live-line--action';
  accion.textContent = String(nucleo.accionLabel || `ACCIÓN: ${nucleo.siguienteAccion || 'REVISAR'}`).slice(
    0,
    72
  );

  const resp = document.createElement('p');
  resp.className = 'hnf-command-nucleus__live-resp';
  resp.textContent = `→ ${String(nucleo.responsableSugerido || '—').slice(0, 32)}`;

  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.id = 'hnf-ejecutar-propuesta-mando';
  btnExec.className = 'primary-button hnf-command-nucleus__cta hnf-command-nucleus__cta--resolve';
  btnExec.textContent = 'RESOLVER AHORA';
  btnExec.addEventListener('click', () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  });

  core.append(kick, presion, metrics, opHoy, solHoy, impacto, accion, resp, btnExec);
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
