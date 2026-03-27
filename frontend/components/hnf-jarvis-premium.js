/**
 * Jarvis HQ — centro de operaciones HNF (solo presentación).
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { buildExecutiveCommandModel } from '../domain/hnf-executive-command.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';
import { whatsappMessagesForOt } from '../domain/control-operativo-tiempo-real.js';

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

function getPlanOtsList(raw) {
  const ots = raw?.planOts ?? raw?.ots?.data ?? [];
  return Array.isArray(ots) ? ots : [];
}

function isOtActiveForLive(o) {
  const st = String(o?.estado || '').toLowerCase();
  return st && !['terminado', 'cerrado', 'cancelado'].includes(st);
}

function outlookMessagesForOt(ot, messages) {
  const list = Array.isArray(messages) ? messages : [];
  const oid = String(ot?.id || '').trim();
  const cli = String(ot?.cliente || '')
    .toLowerCase()
    .trim();
  return list.filter((m) => {
    const linked = String(m?.linkedOtId || m?.otIdRelacionado || '').trim();
    if (oid && linked === oid) return true;
    const blob = `${m?.subject || ''} ${m?.bodyText || ''} ${m?.bodyHtml || ''}`.toLowerCase();
    if (oid && blob.includes(oid.toLowerCase())) return true;
    const hint = String(m?.clientHint || '')
      .toLowerCase()
      .trim();
    if (cli && hint && (cli.includes(hint) || hint.includes(cli))) return true;
    return false;
  });
}

function formatClienteNombre(s) {
  const t = String(s || '').trim();
  if (!t) return '—';
  return t
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .toUpperCase();
}

/**
 * @param {object} ot
 * @param {{ global?: string } | null} ctrlCard
 */
function resolveOtLiveStatus(ot, ctrlCard) {
  if (ctrlCard?.global === 'rojo') {
    return { key: 'urgente', label: 'URGENTE', bar: 'red', pct: 72 };
  }
  const st = String(ot?.estado || '').toLowerCase();
  if (['terminado', 'cerrado'].includes(st)) {
    return { key: 'terminada', label: 'TERMINADA', bar: 'green', pct: 100 };
  }
  if (['en proceso', 'proceso', 'visita', 'ejecucion', 'ejecución'].includes(st)) {
    return { key: 'proceso', label: 'EN PROCESO', bar: 'yellow', pct: 58 };
  }
  if (['pendiente', 'nueva', 'abierta', 'asignada', 'programada'].includes(st)) {
    return { key: 'nueva', label: 'NUEVA', bar: 'yellow', pct: 28 };
  }
  if (st) return { key: 'proceso', label: 'EN PROCESO', bar: 'yellow', pct: 45 };
  return { key: 'nueva', label: 'NUEVA', bar: 'yellow', pct: 28 };
}

function statusSortRank(key) {
  const o = { urgente: 0, proceso: 1, nueva: 2, terminada: 3 };
  return o[key] ?? 9;
}

/** @param {object} raw @param {object[]} cards */
function buildOtLiveRows(raw, cards) {
  const all = getPlanOtsList(raw);
  let active = all.filter(isOtActiveForLive);
  let contextNote = '';
  if (!active.length && all.length) {
    active = all.filter((o) => !['cancelado'].includes(String(o?.estado || '').toLowerCase())).slice(0, 8);
    contextNote = 'Sin OT abiertas en este corte: se muestran órdenes recientes para contexto operativo.';
  }
  const cardByOt = new Map();
  for (const c of Array.isArray(cards) ? cards : []) {
    if (c?.otId) cardByOt.set(String(c.otId), c);
  }
  const waMsgs = raw?.whatsappFeed?.messages ?? [];
  const olMsgs = raw?.outlookFeed?.messages ?? [];

  const rows = active.map((ot) => {
    const id = String(ot?.id || '—');
    const ctrl = cardByOt.get(id) || null;
    const status = resolveOtLiveStatus(ot, ctrl);
    const hasWa = whatsappMessagesForOt(ot, waMsgs).length > 0;
    const hasOl = outlookMessagesForOt(ot, olMsgs).length > 0;
    const title =
      String(ot?.subtipoServicio || ot?.tipoServicio || '').trim() || 'Revisión técnica';
    const desc = truncate(ot?.observaciones || ot?.resumenTrabajo || 'Sin descripción breve.', 120);
    const tech = String(ot?.tecnicoAsignado || 'Sin asignar').trim();
    return {
      ot,
      id,
      cliente: formatClienteNombre(ot?.cliente),
      status,
      channels: { whatsapp: hasWa, email: hasOl },
      title,
      desc,
      tech,
    };
  });

  rows.sort((a, b) => {
    const d = statusSortRank(a.status.key) - statusSortRank(b.status.key);
    if (d !== 0) return d;
    return String(a.id).localeCompare(String(b.id), 'es');
  });

  return { rows: rows.slice(0, 12), contextNote };
}

/** Nombres estables para extensiones (alertas, priorización OT, acciones sugeridas). */
export const JARVIS_PREMIUM_EVENTS = {
  ALERT_NAV: 'hnf-jarvis-premium-alert-nav',
  MODULE_NAV: 'hnf-jarvis-premium-module-nav',
  EXECUTE: 'hnf-jarvis-premium-execute',
  SYNC: 'hnf-jarvis-premium-sync',
  INTEL_TOGGLE: 'hnf-jarvis-premium-intel-toggle',
  OT_LIVE_SELECT: 'hnf-jarvis-premium-ot-live-select',
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

  const mkKpi = (variant, title, value, hint, { ctaLabel, view }) => {
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
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hnf-jarvis-premium__kpi-cta';
    btn.textContent = ctaLabel;
    btn.addEventListener('click', () => {
      emitPremium(JARVIS_PREMIUM_EVENTS.MODULE_NAV, {
        source: 'kpi-card',
        kpiVariant: variant,
        view,
        label: ctaLabel,
      });
      navigateToView?.(view);
    });
    card.append(t, v, h, btn);
    return card;
  };

  kpiRow.append(
    mkKpi(
      'crit',
      'Crítico hoy',
      nCrit,
      nCrit ? 'OT con señal crítica' : 'Sin OT críticas en panel',
      { ctaLabel: 'Revisar OT', view: 'clima' }
    ),
    mkKpi(
      'proc',
      'En proceso',
      nProc,
      nProc ? 'Requieren atención' : 'Sin cola ámbar',
      { ctaLabel: 'Ver pendientes', view: 'clima' }
    ),
    mkKpi(
      'ok',
      'Operación',
      nOk,
      traffic.totalOt ? 'OT en ritmo (verde)' : 'Sin OT cargadas en corte',
      { ctaLabel: 'Completar informe', view: 'clima' }
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

  /* —— Operación en Vivo —— */
  const otLive = document.createElement('section');
  otLive.className = 'hnf-jarvis-premium__ot-live';
  otLive.setAttribute('aria-label', 'Operación en vivo · OT activas');

  const otLiveHead = document.createElement('div');
  otLiveHead.className = 'hnf-jarvis-premium__ot-live-head';
  const otLiveTitles = document.createElement('div');
  const otLiveH = document.createElement('h2');
  otLiveH.className = 'hnf-jarvis-premium__ot-live-title';
  otLiveH.textContent = 'Operación en Vivo';
  const otLiveSub = document.createElement('p');
  otLiveSub.className = 'hnf-jarvis-premium__ot-live-sub';
  otLiveSub.textContent = 'Panel de visibilidad operativa en tiempo casi real';
  otLiveTitles.append(otLiveH, otLiveSub);
  otLiveHead.append(otLiveTitles);

  const { rows: otLiveRows, contextNote } = buildOtLiveRows(raw, adn.cards);
  if (contextNote) {
    const note = document.createElement('p');
    note.className = 'hnf-jarvis-premium__ot-live-note';
    note.textContent = contextNote;
    otLive.append(otLiveHead, note);
  } else {
    otLive.append(otLiveHead);
  }

  const otGrid = document.createElement('div');
  otGrid.className = 'hnf-jarvis-premium__ot-live-grid';

  if (!otLiveRows.length) {
    const empty = document.createElement('p');
    empty.className = 'hnf-jarvis-premium__ot-live-empty';
    empty.textContent =
      'No hay órdenes de trabajo en el corte actual. Abrí Clima operativo para cargar o revisar OT.';
    otGrid.append(empty);
  } else {
    for (const row of otLiveRows) {
      const card = document.createElement('article');
      card.className = 'hnf-jarvis-premium__ot-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.dataset.otId = row.id;
      card.setAttribute('aria-label', `OT ${row.id}, ${row.cliente}, ${row.status.label}`);

      const openClima = () => {
        emitPremium(JARVIS_PREMIUM_EVENTS.OT_LIVE_SELECT, { otId: row.id, source: 'operacion-vivo' });
        if (typeof intelNavigate === 'function') {
          intelNavigate({ view: 'clima', otId: row.id });
        } else {
          navigateToView?.('clima', { otId: row.id });
        }
      };
      card.addEventListener('click', openClima);
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openClima();
        }
      });

      const top = document.createElement('div');
      top.className = 'hnf-jarvis-premium__ot-card-top';
      const otNum = document.createElement('span');
      otNum.className = 'hnf-jarvis-premium__ot-card-id';
      otNum.textContent = row.id;
      const cli = document.createElement('span');
      cli.className = 'hnf-jarvis-premium__ot-card-client';
      cli.textContent = row.cliente;
      top.append(otNum, cli);

      const badges = document.createElement('div');
      badges.className = 'hnf-jarvis-premium__ot-card-badges';
      const stBadge = document.createElement('span');
      stBadge.className = `hnf-jarvis-premium__ot-badge hnf-jarvis-premium__ot-badge--${row.status.key}`;
      stBadge.textContent = row.status.label;
      badges.append(stBadge);

      const chRow = document.createElement('div');
      chRow.className = 'hnf-jarvis-premium__ot-card-channels';
      if (row.channels.whatsapp) {
        const b = document.createElement('span');
        b.className = 'hnf-jarvis-premium__ot-chan hnf-jarvis-premium__ot-chan--wa';
        b.textContent = 'WhatsApp';
        chRow.append(b);
      }
      if (row.channels.email) {
        const b = document.createElement('span');
        b.className = 'hnf-jarvis-premium__ot-chan hnf-jarvis-premium__ot-chan--mail';
        b.textContent = 'Email';
        chRow.append(b);
      }
      if (!chRow.childElementCount) {
        const b = document.createElement('span');
        b.className = 'hnf-jarvis-premium__ot-chan hnf-jarvis-premium__ot-chan--na';
        b.textContent = 'Canal no vinculado';
        chRow.append(b);
      }
      badges.append(chRow);

      const jobTitle = document.createElement('h3');
      jobTitle.className = 'hnf-jarvis-premium__ot-card-job';
      jobTitle.textContent = row.title;

      const jobDesc = document.createElement('p');
      jobDesc.className = 'hnf-jarvis-premium__ot-card-desc';
      jobDesc.textContent = row.desc;

      const techLine = document.createElement('p');
      techLine.className = 'hnf-jarvis-premium__ot-card-tech';
      const techLbl = document.createElement('span');
      techLbl.className = 'hnf-jarvis-premium__ot-card-tech-lbl';
      techLbl.textContent = 'Técnico';
      const techVal = document.createElement('strong');
      techVal.textContent = row.tech;
      techLine.append(techLbl, techVal);

      const barWrap = document.createElement('div');
      barWrap.className = 'hnf-jarvis-premium__ot-progress';
      barWrap.setAttribute('aria-hidden', 'true');
      const barTrack = document.createElement('div');
      barTrack.className = 'hnf-jarvis-premium__ot-progress-track';
      const barFill = document.createElement('div');
      barFill.className = `hnf-jarvis-premium__ot-progress-fill hnf-jarvis-premium__ot-progress-fill--${row.status.bar}`;
      barFill.style.width = `${row.status.pct}%`;
      barTrack.append(barFill);
      barWrap.append(barTrack);

      card.append(top, badges, jobTitle, jobDesc, techLine, barWrap);
      otGrid.append(card);
    }
  }

  otLive.append(otGrid);

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

  main.append(jarvisIa, otLive, modules, intel);
  shell.append(kpiRow, main);
  root.append(atm, shell);

  if (typeof window !== 'undefined') {
    window.HNFJarvisPremium = { EVENTS: JARVIS_PREMIUM_EVENTS };
  }

  return root;
}
