/**
 * Jarvis HQ — centro de operaciones HNF (solo presentación).
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { buildExecutiveCommandModel } from '../domain/hnf-executive-command.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';

let __hnfJarvisPrimaryActionFn = null;
if (typeof window !== 'undefined' && !window.__hnfJarvisPrimaryActionWired) {
  window.__hnfJarvisPrimaryActionWired = true;
  window.addEventListener('hnf-jarvis-primary-action', () => {
    if (typeof __hnfJarvisPrimaryActionFn === 'function') __hnfJarvisPrimaryActionFn();
  });
}

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function ctaFromAccion(s) {
  const u = String(s || '')
    .trim()
    .slice(0, 32);
  return u || 'Ejecutar siguiente paso';
}

function countOtAbiertas(viewData) {
  const ots = viewData?.planOts ?? viewData?.ots?.data ?? [];
  if (!Array.isArray(ots)) return 0;
  return ots.filter((o) => {
    const st = String(o?.estado || '').toLowerCase();
    return st && !['terminado', 'cerrado', 'cancelado'].includes(st);
  }).length;
}

function mapEstadoGlobal(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'critico') return { tone: 'crit' };
  if (e === 'tension') return { tone: 'warn' };
  return { tone: 'ok' };
}

/** Nombres estables para extensiones (alertas, priorización OT, acciones sugeridas). */
export const JARVIS_PREMIUM_EVENTS = {
  ALERT_NAV: 'hnf-jarvis-premium-alert-nav',
  MODULE_NAV: 'hnf-jarvis-premium-module-nav',
  EXECUTE: 'hnf-jarvis-premium-execute',
  SYNC: 'hnf-jarvis-premium-sync',
  INTEL_TOGGLE: 'hnf-jarvis-premium-intel-toggle',
};

function emitPremium(name, detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail: detail ?? {} }));
}

/**
 * @param {object} opts
 * @param {object} opts.data
 * @param {object} opts.liveCmdModel
 * @param {object} opts.alienDecision
 * @param {Function} [opts.intelNavigate]
 * @param {Function} [opts.navigateToView]
 * @param {Function} [opts.reloadApp]
 * @param {Function} [opts.getPulseState]
 */
export function createHnfJarvisPremiumCommand({
  data,
  liveCmdModel,
  alienDecision,
  intelNavigate,
  navigateToView,
  reloadApp,
  getPulseState,
} = {}) {
  const raw = data && typeof data === 'object' ? data : {};
  const adn = raw.hnfAdn && typeof raw.hnfAdn === 'object' ? raw.hnfAdn : buildHnfAdnSnapshot(raw);
  const exec =
    adn.executiveCommand && typeof adn.executiveCommand === 'object'
      ? adn.executiveCommand
      : buildExecutiveCommandModel(raw, {
          cards: adn.cards,
          bottleneck: adn.bottleneck,
          principalProblema: adn.principalProblema,
          recomendacion: adn.recomendacion,
          whatsappHoy: adn.whatsappHoy,
          dineroEnRiesgo: adn.dineroEnRiesgo,
          hnfCoreSolicitudStats: adn.hnfCoreSolicitudStats,
          alertas: adn.alertas,
        });

  const nucleo = adn.jarvisLiveOrbit?.nucleo || {};
  const o = adn.orbits || {};
  const traffic = adn.traffic || { bloqueos: 0, pendientes: 0, ok: 0, totalOt: 0 };
  const alertas = adn.alertas || {};
  const centro = adn.jarvisCentroResumen || exec.centro || {};

  const estado = mapEstadoGlobal(alienDecision?.estadoGlobal);
  const level = Number(liveCmdModel?.level) || 0;
  if (level >= 2) estado.tone = 'crit';
  else if (level >= 1 && estado.tone === 'ok') estado.tone = 'warn';

  const pulseSnap = typeof getPulseState === 'function' ? getPulseState : () => ({ running: false });
  const analyzing = Boolean(pulseSnap()?.running);

  const alerts = Array.isArray(exec.alertasEjecutivas) ? exec.alertasEjecutivas : [];

  const otAbiertas = countOtAbiertas(raw);
  const colaValidacion = Number(centro.requiereValidacion) || 0;
  const sinRespuestaCliente = Number(alertas.noEnviadasCliente) || 0;

  const runExec = () => {
    const cards = Array.isArray(adn.cards) ? adn.cards : [];
    emitPremium(JARVIS_PREMIUM_EVENTS.EXECUTE, {
      ctaLabel: ctaFromAccion(nucleo.siguienteAccion || exec.recomendacion || adn.recomendacion),
      traffic: adn.traffic,
      bottleneck: adn.bottleneck ?? null,
      otCriticas: cards.filter((c) => c.global === 'rojo').length,
      eventosActivos: Array.isArray(adn.eventosUnificados) ? adn.eventosUnificados.length : 0,
    });
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  };
  __hnfJarvisPrimaryActionFn = runExec;

  const root = document.createElement('section');
  root.className = 'hnf-jarvis-premium';
  root.id = 'hnf-mando-principal-v2';
  root.setAttribute('aria-label', 'Centro de operaciones Jarvis');
  root.dataset.presenceTone = estado.tone;
  if (analyzing) root.dataset.pulseActive = '1';

  const atm = document.createElement('div');
  atm.className = 'hnf-jarvis-premium__atm';
  atm.setAttribute('aria-hidden', 'true');
  const atmGrad = document.createElement('div');
  atmGrad.className = 'hnf-jarvis-premium__atm-grad';
  atm.append(atmGrad);

  const shell = document.createElement('div');
  shell.className = 'hnf-jarvis-premium__shell';

  /* —— KPI superior: Crítico / En proceso / Operación —— */
  const kpiRow = document.createElement('div');
  kpiRow.className = 'hnf-jarvis-premium__kpi-row';
  kpiRow.setAttribute('aria-label', 'Resumen operativo del día');

  const nCrit = Number(traffic.bloqueos) || 0;
  const nProc = Number(traffic.pendientes) || 0;
  const nOk = Number(traffic.ok) || 0;

  const mkKpi = (variant, title, value, hint) => {
    const card = document.createElement('div');
    card.className = `hnf-jarvis-premium__kpi hnf-jarvis-premium__kpi--${variant}`;
    const t = document.createElement('span');
    t.className = 'hnf-jarvis-premium__kpi-title';
    t.textContent = title;
    const v = document.createElement('span');
    v.className = 'hnf-jarvis-premium__kpi-value';
    v.textContent = String(value);
    const h = document.createElement('span');
    h.className = 'hnf-jarvis-premium__kpi-hint';
    h.textContent = hint;
    card.append(t, v, h);
    return card;
  };

  kpiRow.append(
    mkKpi(
      'crit',
      'Crítico hoy',
      nCrit,
      nCrit ? 'OT con señal crítica' : 'Sin OT críticas en panel'
    ),
    mkKpi(
      'proc',
      'En proceso',
      nProc,
      nProc ? 'Requieren atención' : 'Sin cola ámbar'
    ),
    mkKpi(
      'ok',
      'Operación',
      nOk,
      traffic.totalOt ? 'OT en ritmo (verde)' : 'Sin OT cargadas en corte'
    )
  );

  /* —— Jarvis IA —— */
  const main = document.createElement('div');
  main.className = 'hnf-jarvis-premium__main';

  const jarvisIa = document.createElement('section');
  jarvisIa.className = 'hnf-jarvis-premium__jarvis-ia';
  jarvisIa.setAttribute('aria-label', 'Jarvis IA · sugerencias operativas');

  const iaTop = document.createElement('div');
  iaTop.className = 'hnf-jarvis-premium__jarvis-ia-top';
  const iaTitles = document.createElement('div');
  const iaH = document.createElement('h2');
  iaH.className = 'hnf-jarvis-premium__jarvis-ia-title';
  iaH.textContent = 'Jarvis IA';
  const iaSub = document.createElement('p');
  iaSub.className = 'hnf-jarvis-premium__jarvis-ia-sub';
  iaSub.textContent = 'Sugerencias accionables según tus datos actuales';
  iaTitles.append(iaH, iaSub);

  const iaSync = document.createElement('button');
  iaSync.type = 'button';
  iaSync.className = 'hnf-jarvis-premium__jarvis-ia-sync';
  iaSync.textContent = 'Sincronizar';
  iaSync.addEventListener('click', async () => {
    emitPremium(JARVIS_PREMIUM_EVENTS.SYNC, { source: 'jarvis-ia' });
    iaSync.disabled = true;
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      iaSync.disabled = false;
    }
  });
  iaTop.append(iaTitles, iaSync);

  const insights = document.createElement('ul');
  insights.className = 'hnf-jarvis-premium__jarvis-ia-insights';
  const insightRows = [
    {
      n: otAbiertas,
      line: `${otAbiertas} OT sin cerrar`,
      empty: 'Sin OT abiertas en el corte actual',
    },
    {
      n: colaValidacion,
      line: `${colaValidacion} ítem(es) en cola de validación / clasificación`,
      empty: 'Cola de validación al día',
    },
    {
      n: sinRespuestaCliente,
      line: `${sinRespuestaCliente} caso(s) sin informe enviado al cliente`,
      empty: 'Sin pendientes de envío a cliente (control tiempo)',
    },
  ];
  for (const row of insightRows) {
    const li = document.createElement('li');
    li.className = 'hnf-jarvis-premium__jarvis-ia-li';
    const strong = document.createElement('strong');
    strong.textContent = row.n > 0 ? row.line : row.empty;
    li.append(strong);
    insights.append(li);
  }

  const iaFocus = document.createElement('p');
  iaFocus.className = 'hnf-jarvis-premium__jarvis-ia-focus';
  iaFocus.textContent = truncate(
    nucleo.problemaPrincipal || adn.principalProblema || 'Operación supervisada. Revisá OT y solicitudes según prioridad.',
    140
  );

  const iaRisk = document.createElement('p');
  iaRisk.className = 'hnf-jarvis-premium__jarvis-ia-risk';
  iaRisk.textContent =
    nucleo.dineroRiesgoFmt ||
    (adn.dineroEnRiesgo
      ? `Exposición estimada ~$${Math.round(adn.dineroEnRiesgo).toLocaleString('es-CL')}`
      : 'Sin monto destacado en riesgo en este corte');

  const btnRevisar = document.createElement('button');
  btnRevisar.type = 'button';
  btnRevisar.id = 'hnf-ejecutar-propuesta-mando';
  btnRevisar.className = 'hnf-jarvis-premium__jarvis-ia-cta';
  btnRevisar.textContent = 'Revisar ahora';
  btnRevisar.setAttribute('aria-label', ctaFromAccion(nucleo.siguienteAccion || exec.recomendacion || adn.recomendacion));
  btnRevisar.addEventListener('click', runExec);

  jarvisIa.append(iaTop, insights, iaFocus, iaRisk, btnRevisar);

  const modules = document.createElement('div');
  modules.className = 'hnf-jarvis-premium__modules';

  const defaults = {
    clima: {
      label: 'Clima operativo',
      view: 'clima',
      hint: 'OT · tiempos · evidencias',
      action: 'Revisar OT',
    },
    flota: {
      label: 'Flota',
      view: 'flota',
      hint: 'Solicitudes y desplazamientos',
      action: 'Ver solicitudes',
    },
    control: {
      label: 'Control',
      view: 'control-gerencial',
      hint: 'Eventos y seguimiento gerencial',
      action: 'Ver operaciones',
    },
    planificacion: {
      label: 'Planificación',
      view: 'planificacion',
      hint: 'Calendario operativo',
      action: 'Ver calendario',
    },
    comercial: {
      label: 'Comercial',
      view: 'oportunidades',
      hint: 'Pipeline y oportunidades',
      action: 'Completar ahora',
    },
  };

  const order = ['clima', 'flota', 'control', 'planificacion', 'comercial'];
  for (const key of order) {
    const def = { ...defaults[key], ...(o[key] || {}) };
    const panel = document.createElement('button');
    panel.type = 'button';
    panel.className = 'hnf-jarvis-premium__panel';
    panel.addEventListener('click', () => {
      emitPremium(JARVIS_PREMIUM_EVENTS.MODULE_NAV, {
        key,
        view: def.view,
        label: def.label,
        badge: def.badge,
      });
      navigateToView?.(def.view);
    });

    const pEyebrow = document.createElement('span');
    pEyebrow.className = 'hnf-jarvis-premium__panel-eyebrow';
    pEyebrow.textContent = def.hint || 'Módulo';

    const pTitle = document.createElement('span');
    pTitle.className = 'hnf-jarvis-premium__panel-title';
    pTitle.textContent = def.label;

    const badge = def.badge != null && def.badge !== '' ? String(def.badge) : '—';
    const pSig = document.createElement('span');
    pSig.className = 'hnf-jarvis-premium__panel-signal';
    pSig.textContent = badge;

    const pGo = document.createElement('span');
    pGo.className = 'hnf-jarvis-premium__panel-action';
    pGo.textContent = def.action || 'Abrir';

    panel.append(pEyebrow, pTitle, pSig, pGo);
    modules.append(panel);
  }

  const intel = document.createElement('details');
  intel.className = 'hnf-jarvis-premium__intel';
  const intelSum = document.createElement('summary');
  intelSum.className = 'hnf-jarvis-premium__intel-sum';
  intelSum.textContent = 'Detalle ejecutivo · alertas y accesos';
  const intelBody = document.createElement('div');
  intelBody.className = 'hnf-jarvis-premium__intel-body';
  if (!alerts.length) {
    const p = document.createElement('p');
    p.className = 'hnf-jarvis-premium__intel-empty';
    p.textContent = 'No hay alertas adicionales en cola ejecutiva.';
    intelBody.append(p);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'hnf-jarvis-premium__intel-list';
    for (const a of alerts.slice(0, 12)) {
      const li = document.createElement('li');
      li.className = 'hnf-jarvis-premium__intel-li';
      const st = document.createElement('strong');
      st.textContent = truncate(a.titulo, 48);
      const sp = document.createElement('span');
      sp.textContent = truncate(a.detalle, 100);
      li.append(st, sp);
      if (a.nav?.view) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hnf-jarvis-premium__intel-btn';
        b.textContent = 'Abrir vista';
        b.addEventListener('click', () => {
          emitPremium(JARVIS_PREMIUM_EVENTS.ALERT_NAV, { alert: a, source: 'intel-list' });
          if (typeof intelNavigate === 'function') intelNavigate(a.nav);
          else navigateToView?.(a.nav.view);
        });
        li.append(b);
      }
      ul.append(li);
    }
    intelBody.append(ul);
  }
  const quick = document.createElement('div');
  quick.className = 'hnf-jarvis-premium__intel-quick';
  for (const q of [
    { t: 'Ingestar correo', v: 'bandeja-canal' },
    { t: 'Documentos técnicos', v: 'documentos-tecnicos' },
    { t: 'HNF Core', v: 'hnf-core' },
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-jarvis-premium__intel-quick-btn';
    b.textContent = q.t;
    b.addEventListener('click', () => {
      emitPremium(JARVIS_PREMIUM_EVENTS.MODULE_NAV, { view: q.v, source: 'intel-quick', label: q.t });
      navigateToView?.(q.v);
    });
    quick.append(b);
  }
  intelBody.append(quick);
  intel.append(intelSum, intelBody);
  intel.addEventListener('toggle', () => {
    emitPremium(JARVIS_PREMIUM_EVENTS.INTEL_TOGGLE, { open: intel.open });
  });

  main.append(jarvisIa, modules, intel);
  shell.append(kpiRow, main);
  root.append(atm, shell);

  if (typeof window !== 'undefined') {
    window.HNFJarvisPremium = { EVENTS: JARVIS_PREMIUM_EVENTS };
  }

  return root;
}
