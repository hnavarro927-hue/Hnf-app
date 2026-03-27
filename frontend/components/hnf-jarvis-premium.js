/**
 * Jarvis HQ — centro de operaciones HNF (solo presentación).
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { buildExecutiveCommandModel } from '../domain/hnf-executive-command.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';
import { whatsappMessagesForOt } from '../domain/control-operativo-tiempo-real.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';
import { hnfOperativoIntegradoService } from '../services/hnf-operativo-integrado.service.js';
import { otService } from '../services/ot.service.js';
import { createJarvisAssistantPanel } from './jarvis-assistant-panel.js';

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

const ADN_TRACE_STEPS = [
  { id: 'solicitud', label: 'Solicitud' },
  { id: 'clasificacion', label: 'Clasificación' },
  { id: 'asignacion', label: 'Asignación' },
  { id: 'ejecucion', label: 'Ejecución' },
  { id: 'informe', label: 'Informe' },
  { id: 'cierre', label: 'Cierre' },
];

function normalizeHoraOt(h) {
  const s = String(h || '09:00').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return '09:00';
}

function safeParseMs(raw) {
  if (raw == null || raw === '') return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) && t > 0 ? t : null;
}

/**
 * Mejor esfuerzo: creación / programación / última actualización (sin tocar backend).
 * @param {object} ot
 * @returns {{ ms: number|null, source: string }}
 */
function resolveOtRequestTiming(ot) {
  const candidates = [
    { v: ot?.createdAt, source: 'createdAt' },
    { v: ot?.creadoEn, source: 'creadoEn' },
    { v: ot?.creado_en, source: 'creado_en' },
  ];
  for (const c of candidates) {
    const ms = safeParseMs(c.v);
    if (ms != null) return { ms, source: c.source };
  }
  const fecha = String(ot?.fecha || '').trim();
  if (fecha) {
    const h = normalizeHoraOt(ot?.hora);
    const ms = safeParseMs(`${fecha}T${h}:00`);
    if (ms != null) return { ms, source: 'fecha_hora' };
    const day = safeParseMs(`${fecha}T00:00:00`);
    if (day != null) return { ms: day, source: 'fecha' };
  }
  const u = safeParseMs(ot?.updatedAt);
  if (u != null) return { ms: u, source: 'updatedAt' };
  return { ms: null, source: 'none' };
}

function formatSolicitudLine(ms) {
  if (ms == null) return 'Solicitud: hora no disponible';
  try {
    const d = new Date(ms);
    const dateStr = d.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `Solicitud: ${dateStr} · ${timeStr}`;
  } catch {
    return 'Solicitud: hora no disponible';
  }
}

function formatElapsedSince(ms, nowMs) {
  if (ms == null) return { line: 'Tiempo transcurrido: —', minutes: null };
  const m = Math.max(0, Math.floor((nowMs - ms) / 60_000));
  const h = Math.floor(m / 60);
  const min = m % 60;
  const label = h > 0 ? `${h}h ${min}m` : `${min}m`;
  return { line: `Tiempo transcurrido: ${label}`, minutes: m };
}

function inferOriginChannel(ot, hasWa, hasOl) {
  if (hasWa && hasOl) return { key: 'whatsapp', label: 'WhatsApp' };
  if (hasWa) return { key: 'whatsapp', label: 'WhatsApp' };
  if (hasOl) return { key: 'correo', label: 'Correo' };
  const blob = `${ot?.observaciones || ''} ${ot?.resumenTrabajo || ''}`.toLowerCase();
  if (/\b(llamada|teléfono|telefono|fono|llam[oó]|call center)\b/.test(blob)) {
    return { key: 'llamada', label: 'Llamada' };
  }
  return { key: 'manual', label: 'Manual' };
}

/**
 * @param {object} ot
 * @param {object|null} ctrl
 */
function computeAdnOperationalTrace(ot, ctrl) {
  const st = String(ot?.estado || '').toLowerCase();
  const et1 = ctrl?.etapa1;
  const gaps0 = ctrl
    ? (et1?.gapsCount ?? 0) === 0
    : getEvidenceGaps(ot).length === 0;
  const pdfOk = Boolean(et1?.pdfOk || String(ot?.pdfUrl || '').trim());
  const hasTipo = Boolean(String(ot?.subtipoServicio || ot?.tipoServicio || '').trim());
  const techRaw = String(ot?.tecnicoAsignado || '').trim();
  const hasTech = Boolean(techRaw) && !/^sin\s+asignar$/i.test(techRaw);
  const terminado = st === 'terminado' || st === 'cerrado';

  const completed = [true, hasTipo, hasTech, gaps0, pdfOk, terminado];
  let activeIdx = completed.findIndex((c) => !c);
  if (activeIdx === -1) activeIdx = ADN_TRACE_STEPS.length - 1;

  const step = ADN_TRACE_STEPS[activeIdx];
  return {
    steps: ADN_TRACE_STEPS,
    completed,
    activeIdx,
    currentStageId: step.id,
    currentLabel: step.label,
  };
}

function toIsoOrNull(ms) {
  if (ms == null || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

/**
 * Payload estable para registro operativo / control de horas (extensible sin backend nuevo).
 * @param {object} p
 */
function buildOtTraceabilityPayload(p) {
  const {
    id,
    ot,
    origin,
    requestMs,
    elapsedMinutes,
    ctrl,
    trace,
    techDisplay,
    nowMs,
  } = p;
  const st = String(ot?.estado || '').toLowerCase();
  const et1 = ctrl?.etapa1;
  const et2 = ctrl?.etapa2;
  const et3 = ctrl?.etapa3;
  const pdfOk = Boolean(et1?.pdfOk || String(ot?.pdfUrl || '').trim());
  const visitMs = (() => {
    const fecha = String(ot?.fecha || '').trim();
    if (!fecha) return null;
    return safeParseMs(`${fecha}T${normalizeHoraOt(ot?.hora)}:00`);
  })();
  const closedMs = safeParseMs(ot?.cerradoEn);

  return {
    ot_id: id,
    request_created_at: toIsoOrNull(requestMs),
    classified_at: trace.completed[1] ? toIsoOrNull(requestMs) : null,
    assigned_at: trace.completed[2] ? toIsoOrNull(safeParseMs(ot?.updatedAt)) : null,
    execution_started_at:
      st === 'en proceso' || st === 'proceso' || st === 'visita'
        ? toIsoOrNull(visitMs || requestMs)
        : null,
    report_completed_at: pdfOk ? toIsoOrNull(safeParseMs(ot?.updatedAt)) : null,
    closed_at: terminadoOrClosed(st) ? toIsoOrNull(closedMs || safeParseMs(ot?.updatedAt)) : null,
    technician_name: techDisplay && !/^sin\s+asignar$/i.test(techDisplay) ? techDisplay : null,
    elapsed_minutes: elapsedMinutes,
    origin_channel: origin.key,
    current_stage: trace.currentStageId,
    current_stage_index: trace.activeIdx,
    captured_at: toIsoOrNull(nowMs),
    adn_operational: ctrl
      ? {
          card_global: ctrl.global ?? null,
          evidencia_completa: (et1?.gapsCount ?? 0) === 0,
          pdf_generado: Boolean(et1?.pdfOk),
          admin_estado: et2?.estado ?? null,
          informe_cliente_enviado: Boolean(et3?.enviado),
        }
      : null,
  };
}

function terminadoOrClosed(st) {
  return st === 'terminado' || st === 'cerrado';
}

/** @param {object} raw @param {object[]} cards @param {number} nowMs */
function buildOtLiveRows(raw, cards, nowMs = Date.now()) {
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
    const origin = inferOriginChannel(ot, hasWa, hasOl);
    const title =
      String(ot?.subtipoServicio || ot?.tipoServicio || '').trim() || 'Revisión técnica';
    const desc = truncate(ot?.observaciones || ot?.resumenTrabajo || 'Sin descripción breve.', 120);
    const techRaw = String(ot?.tecnicoAsignado || '').trim();
    const tech = techRaw || 'Sin asignar';
    const tipoLabel =
      String(ot?.subtipoServicio || ot?.tipoServicio || '').trim() || 'Sin clasificar';
    const informeLabel = String(ot?.pdfUrl || '').trim() ? 'Generado' : 'Pendiente';

    const { ms: requestMs } = resolveOtRequestTiming(ot);
    const { line: elapsedLine, minutes: elapsedMinutes } = formatElapsedSince(requestMs, nowMs);
    const solicitudLine = formatSolicitudLine(requestMs);

    const trace = computeAdnOperationalTrace(ot, ctrl);
    const traceabilityHook = buildOtTraceabilityPayload({
      id,
      ot,
      origin,
      requestMs,
      elapsedMinutes,
      ctrl,
      trace,
      techDisplay: tech,
      nowMs,
    });

    return {
      ot,
      id,
      cliente: formatClienteNombre(ot?.cliente),
      status,
      channels: { whatsapp: hasWa, email: hasOl },
      origin,
      title,
      desc,
      tech,
      tipoLabel,
      informeLabel,
      solicitudLine,
      elapsedLine,
      trace,
      traceabilityHook,
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

  /* Capas 1–3: imagen industrial + overlay oscuro + brillos Flota / núcleo / Clima */
  const scene = document.createElement('div');
  scene.className = 'hnf-jarvis-premium__scene';
  scene.setAttribute('aria-hidden', 'true');
  const bgImg = document.createElement('div');
  bgImg.className = 'hnf-jarvis-premium__bg-img';
  const bgOverlay = document.createElement('div');
  bgOverlay.className = 'hnf-jarvis-premium__bg-overlay';
  const bgGlows = document.createElement('div');
  bgGlows.className = 'hnf-jarvis-premium__bg-glows';
  const gFlota = document.createElement('div');
  gFlota.className = 'hnf-jarvis-premium__bg-glow hnf-jarvis-premium__bg-glow--flota';
  const gCore = document.createElement('div');
  gCore.className = 'hnf-jarvis-premium__bg-glow hnf-jarvis-premium__bg-glow--core';
  const gClima = document.createElement('div');
  gClima.className = 'hnf-jarvis-premium__bg-glow hnf-jarvis-premium__bg-glow--clima';
  bgGlows.append(gFlota, gCore, gClima);
  scene.append(bgImg, bgOverlay, bgGlows);

  const shell = document.createElement('div');
  shell.className = 'hnf-jarvis-premium__shell';

  /* —— Barra de identidad (capa 4–5: vidrio + contenido) —— */
  const hero = document.createElement('header');
  hero.className = 'hnf-jarvis-premium__hero';
  hero.setAttribute('aria-label', 'Centro de energía operativa HNF');
  const heroCopy = document.createElement('div');
  heroCopy.className = 'hnf-jarvis-premium__hero-copy';
  const heroTag = document.createElement('p');
  heroTag.className = 'hnf-jarvis-premium__hero-tag';
  heroTag.textContent = 'HNF Servicios Integrales';
  const heroLine = document.createElement('p');
  heroLine.className = 'hnf-jarvis-premium__hero-line';
  heroLine.textContent = 'Continuidad operacional sin interrupciones';
  const heroChips = document.createElement('div');
  heroChips.className = 'hnf-jarvis-premium__hero-chips';
  const chipFlota = document.createElement('span');
  chipFlota.className = 'hnf-jarvis-premium__hero-chip hnf-jarvis-premium__hero-chip--flota';
  chipFlota.textContent = 'Flota';
  const chipClima = document.createElement('span');
  chipClima.className = 'hnf-jarvis-premium__hero-chip hnf-jarvis-premium__hero-chip--clima';
  chipClima.textContent = 'Clima · HVAC';
  heroChips.append(chipFlota, chipClima);
  heroCopy.append(heroTag, heroLine, heroChips);
  hero.append(heroCopy);

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
  jarvisIa.className = 'hnf-jarvis-premium__jarvis-ia hnf-jarvis-copilot-surface';
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

  const assistantPanel = createJarvisAssistantPanel({
    data: raw,
    controlCards: Array.isArray(adn.cards) ? adn.cards : [],
    ingestionHooks: {
      postCargaMasiva: (body) => hnfOperativoIntegradoService.postCargaMasiva(body),
      postExtendedClient: (body) => hnfOperativoIntegradoService.postExtendedClient(body),
      postInternalDirectory: (body) => hnfOperativoIntegradoService.postInternalDirectory(body),
      createOt: (payload) => otService.create(payload),
    },
    onAfterIngestionSave: async () => {
      if (typeof reloadApp === 'function') await reloadApp();
    },
  });

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

  const { rows: otLiveRows, contextNote } = buildOtLiveRows(raw, adn.cards, Date.now());
  if (contextNote) {
    const note = document.createElement('p');
    note.className = 'hnf-jarvis-premium__ot-live-note';
    note.textContent = contextNote;
    otLive.append(otLiveHead, note);
  } else {
    otLive.append(otLiveHead);
  }

  const otList = document.createElement('div');
  otList.className = 'hnf-jarvis-premium__ot-live-list';

  const mkSep = () => {
    const s = document.createElement('span');
    s.className = 'hnf-jarvis-premium__ot-row-sep';
    s.textContent = '|';
    s.setAttribute('aria-hidden', 'true');
    return s;
  };

  if (!otLiveRows.length) {
    const empty = document.createElement('p');
    empty.className = 'hnf-jarvis-premium__ot-live-empty';
    empty.textContent =
      'No hay órdenes de trabajo en el corte actual. Abrí Clima operativo para cargar o revisar OT.';
    otList.append(empty);
  } else {
    for (const row of otLiveRows) {
      const channelsHint = [
        row.channels.whatsapp ? 'WhatsApp' : null,
        row.channels.email ? 'Email' : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const article = document.createElement('article');
      article.className = 'hnf-jarvis-premium__ot-row';
      article.tabIndex = 0;
      article.setAttribute('role', 'button');
      article.dataset.otId = row.id;
      article.dataset.otStatus = row.status.key;
      article.dataset.originChannel = row.origin.key;
      article.dataset.currentStage = row.trace.currentStageId;
      if (row.traceabilityHook.elapsed_minutes != null) {
        article.dataset.elapsedMinutes = String(row.traceabilityHook.elapsed_minutes);
      }
      article.hnfOtTraceability = row.traceabilityHook;
      article.setAttribute(
        'aria-label',
        `OT ${row.id}, ${row.cliente}, ${row.status.label}, Origen ${row.origin.label}${channelsHint ? `, ${channelsHint}` : ''}`
      );

      const openClima = () => {
        emitPremium(JARVIS_PREMIUM_EVENTS.OT_LIVE_SELECT, {
          otId: row.id,
          source: 'operacion-vivo',
          traceability: row.traceabilityHook,
        });
        if (typeof intelNavigate === 'function') {
          intelNavigate({ view: 'clima', otId: row.id });
        } else {
          navigateToView?.('clima', { otId: row.id });
        }
      };
      article.addEventListener('click', openClima);
      article.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openClima();
        }
      });

      const meta = document.createElement('div');
      meta.className = 'hnf-jarvis-premium__ot-row-meta';
      const otNum = document.createElement('span');
      otNum.className = 'hnf-jarvis-premium__ot-row-id';
      otNum.textContent = row.id;
      const cli = document.createElement('span');
      cli.className = 'hnf-jarvis-premium__ot-row-client';
      cli.textContent = row.cliente;
      const stBadge = document.createElement('span');
      stBadge.className = `hnf-jarvis-premium__ot-badge hnf-jarvis-premium__ot-badge--${row.status.key}`;
      stBadge.textContent = row.status.label;
      const originWrap = document.createElement('span');
      originWrap.className = 'hnf-jarvis-premium__ot-origin-wrap';
      const originLbl = document.createElement('span');
      originLbl.className = 'hnf-jarvis-premium__ot-origin-lbl';
      originLbl.textContent = 'Origen:';
      const originBadge = document.createElement('span');
      originBadge.className = `hnf-jarvis-premium__ot-origin hnf-jarvis-premium__ot-origin--${row.origin.key}`;
      originBadge.textContent = row.origin.label;
      originWrap.append(originLbl, originBadge);
      meta.append(otNum, mkSep(), cli, mkSep(), stBadge, mkSep(), originWrap);

      const body = document.createElement('div');
      body.className = 'hnf-jarvis-premium__ot-row-body';
      const jobTitle = document.createElement('h3');
      jobTitle.className = 'hnf-jarvis-premium__ot-row-title';
      jobTitle.textContent = row.title;
      const jobDesc = document.createElement('p');
      jobDesc.className = 'hnf-jarvis-premium__ot-row-desc';
      jobDesc.textContent = row.desc;
      body.append(jobTitle, jobDesc);

      const mkKv = (lbl, val) => {
        const d = document.createElement('div');
        d.className = 'hnf-jarvis-premium__ot-row-kv';
        const k = document.createElement('span');
        k.className = 'hnf-jarvis-premium__ot-row-k';
        k.textContent = lbl;
        const v = document.createElement('span');
        v.className = 'hnf-jarvis-premium__ot-row-v';
        v.textContent = val;
        d.append(k, v);
        return d;
      };

      const aux = document.createElement('div');
      aux.className = 'hnf-jarvis-premium__ot-row-aux';
      aux.append(
        mkKv('Tipo:', row.tipoLabel),
        mkKv('Informe:', row.informeLabel),
        mkKv('Responsable:', row.tech),
        (() => {
          const d = document.createElement('div');
          d.className = 'hnf-jarvis-premium__ot-row-kv hnf-jarvis-premium__ot-row-kv--full';
          d.textContent = row.solicitudLine;
          return d;
        })(),
        (() => {
          const d = document.createElement('div');
          d.className = 'hnf-jarvis-premium__ot-row-kv hnf-jarvis-premium__ot-row-kv--full';
          d.textContent = row.elapsedLine;
          return d;
        })(),
        mkKv('Etapa actual:', row.trace.currentLabel)
      );

      const traceEl = document.createElement('div');
      traceEl.className = 'hnf-jarvis-premium__ot-trace';
      traceEl.setAttribute('aria-label', `Traza operativa ADN, etapa ${row.trace.currentLabel}`);
      const stepsRow = document.createElement('div');
      stepsRow.className = 'hnf-jarvis-premium__ot-trace-steps';
      const { steps, activeIdx } = row.trace;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const el = document.createElement('span');
        el.className = 'hnf-jarvis-premium__ot-trace-step';
        if (i < activeIdx) el.classList.add('hnf-jarvis-premium__ot-trace-step--done');
        else if (i === activeIdx) el.classList.add('hnf-jarvis-premium__ot-trace-step--active');
        else el.classList.add('hnf-jarvis-premium__ot-trace-step--pending');
        el.textContent = step.label;
        el.dataset.traceStep = step.id;
        stepsRow.append(el);
        if (i < steps.length - 1) {
          const ar = document.createElement('span');
          ar.className = 'hnf-jarvis-premium__ot-trace-arrow';
          ar.textContent = '→';
          ar.setAttribute('aria-hidden', 'true');
          stepsRow.append(ar);
        }
      }
      traceEl.append(stepsRow);

      const barWrap = document.createElement('div');
      barWrap.className = `hnf-jarvis-premium__ot-progress hnf-jarvis-premium__ot-progress--${row.status.key}`;
      barWrap.setAttribute('aria-hidden', 'true');
      const barTrack = document.createElement('div');
      barTrack.className = 'hnf-jarvis-premium__ot-progress-track';
      const barFill = document.createElement('div');
      barFill.className = `hnf-jarvis-premium__ot-progress-fill hnf-jarvis-premium__ot-progress-fill--${row.status.bar}`;
      if (row.status.key !== 'terminada') {
        barFill.classList.add('hnf-jarvis-premium__ot-progress-fill--shimmer');
      }
      if (row.status.key === 'proceso') {
        barFill.classList.add('hnf-jarvis-premium__ot-progress-fill--sweep');
      }
      barTrack.append(barFill);
      barWrap.append(barTrack);

      article.append(meta, body, aux, traceEl, barWrap);
      otList.append(article);
    }
  }

  otLive.append(otList);

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
    if (key === 'flota') panel.classList.add('hnf-jarvis-premium__panel--line-flota');
    if (key === 'clima') panel.classList.add('hnf-jarvis-premium__panel--line-clima');
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

  main.append(jarvisIa, assistantPanel, otLive, modules, intel);
  shell.append(hero, kpiRow, main);
  root.append(scene, shell);

  if (typeof window !== 'undefined') {
    window.HNFJarvisPremium = { EVENTS: JARVIS_PREMIUM_EVENTS };
  }

  return root;
}
