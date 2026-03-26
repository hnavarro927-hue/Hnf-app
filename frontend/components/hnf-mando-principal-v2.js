/**
 * Centro de mando HNF — única capa visible en home Jarvis:
 * núcleo (problema + impacto + 1 acción) + 5 órbitas compactas.
 * Datos: `data.hnfAdn` (loadFullOperationalData). Sin bloques de detalle aquí.
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';

function flattenTopActions(board, limit = 1) {
  const order = ['ejecutar_hoy', 'cobrar_hoy', 'aprobar_hoy', 'revisar_hoy', 'vender_hoy', 'seguimiento'];
  const out = [];
  const b = board?.buckets || {};
  for (const key of order) {
    for (const a of b[key] || []) {
      out.push(a);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function fmtMoney(n) {
  return Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

/** @returns {{ label: string, mod: string }} */
function toneFromCounts(bloqueos, pendientes) {
  if (bloqueos > 0) return { label: 'CRÍTICO', mod: 'crit' };
  if (pendientes > 0) return { label: 'ATENCIÓN', mod: 'warn' };
  return { label: 'OK', mod: 'ok' };
}

function orbitTone(badge, { crit = 5, warn = 1 } = {}) {
  const n = Number(badge) || 0;
  if (n >= crit) return { label: 'CRÍTICO', mod: 'crit' };
  if (n >= warn) return { label: 'ATENCIÓN', mod: 'warn' };
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
  liveCmdModel,
  board,
  intelNavigate,
  navigateToView,
  reloadApp,
}) {
  const raw = data || {};
  const adn = raw.hnfAdn && typeof raw.hnfAdn === 'object' ? raw.hnfAdn : buildHnfAdnSnapshot(raw);
  const { bloqueos, pendientes, ok } = adn.traffic;
  const tops = flattenTopActions(board, 1);

  const wrap = document.createElement('section');
  wrap.className = 'hnf-command-deck';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Jarvis — centro de mando');

  const deck = document.createElement('div');
  deck.className = 'hnf-command-deck__grid';

  const mkOrbit = (key, o, tone, critLine) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `hnf-orbit-card hnf-orbit-card--${tone.mod} hnf-orbit-card--${key}`;
    btn.setAttribute('aria-label', `Abrir ${o.label}`);
    const nm = document.createElement('span');
    nm.className = 'hnf-orbit-card__name';
    nm.textContent = o.label;
    const st = document.createElement('span');
    st.className = 'hnf-orbit-card__state';
    st.textContent = tone.label;
    const cr = document.createElement('span');
    cr.className = 'hnf-orbit-card__crit';
    cr.textContent = critLine;
    const go = document.createElement('span');
    go.className = 'hnf-orbit-card__go';
    go.textContent = 'Entrar';
    btn.append(nm, st, cr, go);
    btn.addEventListener('click', () => navigateToView?.(o.view));
    return btn;
  };

  const o = adn.orbits || {};
  const climaTone = toneFromCounts(bloqueos, pendientes);
  const climaCrit =
    bloqueos > 0
      ? `${bloqueos} bloq.`
      : pendientes > 0
        ? `${pendientes} pend.`
        : `${ok} OK`;

  const flotaN = Number(o.flota?.badge) || 0;
  const planN = Number(o.planificacion?.badge) || 0;
  const comN = Number(o.comercial?.badge) || 0;
  const ctrlN = Number(o.control?.badge) || 0;

  const orbitPlan = mkOrbit('plan', o.planificacion || { label: 'Planificación', view: 'planificacion' }, orbitTone(planN, { crit: 4, warn: 1 }), planN ? `${planN} alertas` : 'Sin alertas');
  const orbitFlota = mkOrbit('flota', o.flota || { label: 'Flota', view: 'flota' }, orbitTone(flotaN, { crit: 4, warn: 1 }), flotaN ? `${flotaN} abiertas` : 'Cola limpia');
  const orbitClima = mkOrbit('clima', o.clima || { label: 'Clima', view: 'clima' }, climaTone, climaCrit);
  const orbitCom = mkOrbit('com', o.comercial || { label: 'Comercial', view: 'oportunidades' }, orbitTone(comN, { crit: 6, warn: 2 }), comN ? `${comN} ítems` : 'Sin cola');
  const orbitCtrl = mkOrbit('ctrl', o.control || { label: 'Control', view: 'control-gerencial' }, orbitTone(ctrlN, { crit: 5, warn: 1 }), ctrlN ? `${ctrlN} eventos` : 'Sin eventos');

  const nucleus = document.createElement('div');
  nucleus.className = 'hnf-command-nucleus';
  nucleus.setAttribute('aria-label', 'Núcleo Jarvis · ADN');

  const ring = document.createElement('div');
  ring.className = 'hnf-command-nucleus__adn-ring';
  ring.innerHTML =
    '<span class="hnf-command-nucleus__adn-glow"></span><span class="hnf-command-nucleus__adn-track"></span>';

  const core = document.createElement('div');
  core.className = 'hnf-command-nucleus__core';

  const problema = document.createElement('p');
  problema.className = 'hnf-command-nucleus__problem';
  problema.textContent = String(adn.principalProblema || '—').slice(0, 120);

  const impacto = document.createElement('p');
  impacto.className = 'hnf-command-nucleus__impact';
  impacto.textContent = `$${fmtMoney(adn.dineroEnRiesgo)} riesgo · ${bloqueos} bloqueos · ${pendientes} pendientes`;

  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.id = 'hnf-ejecutar-propuesta-mando';
  btnExec.className = 'primary-button hnf-command-nucleus__cta';
  const ctaShort = tops[0]
    ? String(tops[0].titulo || tops[0].motivo || 'Ejecutar').replace(/\s+/g, ' ').trim().slice(0, 36)
    : '';
  btnExec.textContent = ctaShort ? `Ejecutar · ${ctaShort}` : 'Ejecutar decisión';
  btnExec.addEventListener('click', () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  });

  core.append(problema, impacto, btnExec);
  nucleus.append(ring, core);

  deck.append(orbitPlan, orbitFlota, nucleus, orbitClima, orbitCom, orbitCtrl);

  const foot = document.createElement('footer');
  foot.className = 'hnf-command-deck__foot';
  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'hnf-command-deck__sync secondary-button';
  sync.textContent = 'Sincronizar';
  sync.addEventListener('click', async () => {
    sync.disabled = true;
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      sync.disabled = false;
    }
  });
  const hint = document.createElement('span');
  hint.className = 'muted small hnf-command-deck__hint';
  hint.textContent = 'Detalle técnico e ingesta: desplegable «Comando extendido» debajo.';
  foot.append(sync, hint);

  wrap.append(deck, foot);
  return wrap;
}
