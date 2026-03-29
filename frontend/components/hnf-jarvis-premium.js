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
import { computeCommandCenterMetrics } from '../domain/hnf-command-center-metrics.js';
import { createJarvisAssistantPanel } from './jarvis-assistant-panel.js';
import { computeOtSlaTierForOperativeOt } from '../domain/hnf-ot-sla-presentation.js';

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
  return st && !['terminado', 'cerrada', 'cerrado', 'cancelado'].includes(st);
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
  if (['terminado', 'cerrada', 'cerrado'].includes(st)) {
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
  const terminado = st === 'terminado' || st === 'cerrada' || st === 'cerrado';

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
  return st === 'terminado' || st === 'cerrada' || st === 'cerrado';
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
    const slaTier = computeOtSlaTierForOperativeOt(ot, requestMs, nowMs);
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
      slaTier,
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
 * @param {string} [opts.integrationStatus]
 * @param {string|null} [opts.lastDataRefreshAt]
 */
export function createHnfJarvisPremiumCommand({
  data,
  liveCmdModel,
  alienDecision,
  intelNavigate,
  navigateToView,
  reloadApp,
  getPulseState,
  integrationStatus = 'pendiente',
  lastDataRefreshAt = null,
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

  const estado = mapEstadoGlobal(alienDecision?.estadoGlobal);
  const level = Number(liveCmdModel?.level) || 0;
  if (level >= 2) estado.tone = 'crit';
  else if (level >= 1 && estado.tone === 'ok') estado.tone = 'warn';

  const pulseSnap = typeof getPulseState === 'function' ? getPulseState : () => ({ running: false });
  const analyzing = Boolean(pulseSnap()?.running);

  const alerts = Array.isArray(exec.alertasEjecutivas) ? exec.alertasEjecutivas : [];

  const ccMetrics = computeCommandCenterMetrics(raw, { hnfAdn: adn });

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

  let syncTxt = '—';
  if (lastDataRefreshAt) {
    try {
      syncTxt = new Date(lastDataRefreshAt).toLocaleString('es-CL', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    } catch {
      syncTxt = String(lastDataRefreshAt);
    }
  }
  const integShort =
    integrationStatus === 'conectado' ? 'En línea' : integrationStatus === 'sin conexión' ? 'Sin conexión' : 'Sincronizando…';

  /* —— Hero dominante (sin micro-cajas) —— */
  const hero = document.createElement('header');
  hero.className = 'hnf-jarvis-premium__hero hnf-portada-hero--command';
  hero.setAttribute('aria-label', 'Centro de operaciones HNF');
  const heroInner = document.createElement('div');
  heroInner.className = 'hnf-portada-hero__inner';
  const heroTag = document.createElement('p');
  heroTag.className = 'hnf-portada-hero__eyebrow';
  heroTag.textContent = 'HNF Servicios Integrales';
  const heroLine = document.createElement('h1');
  heroLine.className = 'hnf-portada-hero__title';
  heroLine.textContent = 'Centro de Operaciones HNF';
  const heroSub = document.createElement('p');
  heroSub.className = 'hnf-portada-hero__lede';
  heroSub.textContent = 'Control operativo en tiempo real con asistencia Jarvis';
  const heroFoot = document.createElement('p');
  heroFoot.className = 'hnf-portada-hero__foot';
  const pulseDot = document.createElement('span');
  pulseDot.className = 'hnf-portada-hero__pulse-dot';
  const jarvisLab = document.createElement('span');
  jarvisLab.append(document.createTextNode('Jarvis '), (() => {
    const s = document.createElement('strong');
    s.textContent = 'Activo';
    return s;
  })());
  const sep = () => {
    const x = document.createElement('span');
    x.className = 'hnf-portada-hero__sep';
    x.textContent = '·';
    return x;
  };
  const syncLine = document.createElement('span');
  syncLine.textContent = `Última sync ${syncTxt}`;
  heroFoot.append(pulseDot, document.createTextNode(' '), jarvisLab, sep(), document.createTextNode(` ${integShort} `), sep(), document.createTextNode(' '), syncLine);
  heroInner.append(heroTag, heroLine, heroSub, heroFoot);
  hero.append(heroInner);

  /* —— Centro Jarvis (núcleo) —— */
  const main = document.createElement('div');
  main.className = 'hnf-jarvis-premium__main';

  const jarvisIa = document.createElement('section');
  jarvisIa.className = 'hnf-jarvis-hq-core hnf-jarvis-hq-core--compact';
  jarvisIa.setAttribute('aria-label', 'Centro Jarvis · resumen');

  const hqTop = document.createElement('div');
  hqTop.className = 'hnf-jarvis-hq-core__top';
  const hqTitles = document.createElement('div');
  const iaH = document.createElement('h2');
  iaH.className = 'hnf-jarvis-hq-core__title';
  iaH.textContent = 'Centro Jarvis';
  const iaSub = document.createElement('p');
  iaSub.className = 'hnf-jarvis-hq-core__subtitle';
  iaSub.textContent = 'Resumen en portada · prioridad y riesgo en el asistente flotante';
  hqTitles.append(iaH, iaSub);
  const iaSync = document.createElement('button');
  iaSync.type = 'button';
  iaSync.className = 'hnf-jarvis-hq-core__sync';
  iaSync.textContent = 'Sincronizar';
  iaSync.addEventListener('click', async () => {
    emitPremium(JARVIS_PREMIUM_EVENTS.SYNC, { source: 'jarvis-hq-core' });
    iaSync.disabled = true;
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      iaSync.disabled = false;
    }
  });
  hqTop.append(hqTitles, iaSync);

  const compactLede = document.createElement('p');
  compactLede.className = 'hnf-jarvis-hq-core__compact-lede';
  compactLede.textContent = truncate(
    nucleo.siguienteAccion ||
      exec.recomendacion ||
      adn.recomendacion ||
      liveCmdModel?.headline ||
      'Operación monitoreada. Abrí el asistente flotante para prioridad, riesgo y acciones.',
    240
  );
  const compactHint = document.createElement('p');
  compactHint.className = 'hnf-jarvis-hq-core__compact-hint';
  compactHint.textContent =
    'Prioridad, riesgo y atajos están en el asistente flotante (esquina inferior derecha), sin ocupar el tablero.';

  const engineLines = Array.isArray(liveCmdModel?.operativeEngineLines) ? liveCmdModel.operativeEngineLines : [];
  const opEngine = document.createElement('div');
  opEngine.className = 'hnf-jarvis-hq-core__op-engine';
  opEngine.setAttribute('aria-label', 'Motor Jarvis operativo v1');
  const opH = document.createElement('h3');
  opH.className = 'hnf-jarvis-hq-core__op-engine-title';
  opH.textContent = 'Motor operativo · colas y trazabilidad';
  const opUl = document.createElement('ul');
  opUl.className = 'hnf-jarvis-hq-core__op-engine-ul';
  for (const line of engineLines.slice(0, 8)) {
    const li = document.createElement('li');
    li.textContent = line;
    opUl.append(li);
  }
  opEngine.append(opH, opUl);

  const btnEjecutarMando = document.createElement('button');
  btnEjecutarMando.type = 'button';
  btnEjecutarMando.id = 'hnf-ejecutar-propuesta-mando';
  btnEjecutarMando.className = 'hnf-jarvis-hq-core__compact-exec';
  btnEjecutarMando.textContent = ctaFromAccion(nucleo.siguienteAccion || exec.recomendacion || adn.recomendacion);
  btnEjecutarMando.addEventListener('click', runExec);

  jarvisIa.append(hqTop, compactLede, compactHint, opEngine, btnEjecutarMando);

  /* —— Tres portales de módulo (grandes) —— */
  const modulePortals = document.createElement('div');
  modulePortals.className = 'hnf-portada-module-portals';
  modulePortals.setAttribute('aria-label', 'Acceso a módulos operativos');
  const mkPortal = (title, desc, icon, modClass, view) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = `hnf-portada-portal ${modClass}`;
    const ic = document.createElement('span');
    ic.className = 'hnf-portada-portal__icon';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = icon;
    const t = document.createElement('span');
    t.className = 'hnf-portada-portal__title';
    t.textContent = title;
    const d = document.createElement('span');
    d.className = 'hnf-portada-portal__desc';
    d.textContent = desc;
    const e = document.createElement('span');
    e.className = 'hnf-portada-portal__enter';
    e.textContent = 'Entrar';
    a.append(ic, t, d, e);
    a.addEventListener('click', () => {
      emitPremium(JARVIS_PREMIUM_EVENTS.MODULE_NAV, { source: 'portada-portal', view, label: title });
      navigateToView?.(view);
    });
    return a;
  };
  modulePortals.append(
    mkPortal('Clima', 'OT · HVAC · evidencias y cierre', '◎', 'hnf-portada-portal--clima', 'clima'),
    mkPortal('Flota', 'Solicitudes · trazabilidad 360°', '◆', 'hnf-portada-portal--flota', 'flota'),
    mkPortal('Matrix / Control', 'KPIs · gerencia · mando', '⬡', 'hnf-portada-portal--matrix', 'control-gerencial')
  );

  /* —— Resumen ejecutivo: 4 indicadores —— */
  const execStrip = document.createElement('div');
  execStrip.className = 'hnf-portada-exec-strip';
  execStrip.setAttribute('aria-label', 'Resumen ejecutivo');
  const mkExec = (label, value) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'hnf-portada-exec-strip__cell';
    const vv = document.createElement('span');
    vv.className = 'hnf-portada-exec-strip__value';
    vv.textContent = String(value);
    const ll = document.createElement('span');
    ll.className = 'hnf-portada-exec-strip__label';
    ll.textContent = label;
    d.append(vv, ll);
    d.addEventListener('click', () => {
      emitPremium(JARVIS_PREMIUM_EVENTS.MODULE_NAV, { source: 'exec-strip', view: 'clima', label });
      navigateToView?.('clima');
    });
    return d;
  };
  execStrip.append(
    mkExec('OT activas', String(ccMetrics.otActivas)),
    mkExec('En riesgo', String(ccMetrics.otEnRiesgo)),
    mkExec('Sin evidencia', String(ccMetrics.otSinEvidenciaCompleta)),
    mkExec('Pendientes', String(ccMetrics.otPendientesCierre))
  );

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
  otLive.className = 'hnf-jarvis-premium__ot-live hnf-portada-ot-live';
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
      if (row.status.key === 'urgente') {
        article.classList.add('hnf-jarvis-premium__ot-row--urgente');
      }
      if (row.slaTier) article.dataset.hnfSlaTier = row.slaTier;
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

  const intel = document.createElement('details');
  intel.className = 'hnf-jarvis-premium__intel';
  const intelSum = document.createElement('summary');
  intelSum.className = 'hnf-jarvis-premium__intel-sum';
  intelSum.textContent = 'Detalle ejecutivo (expandir)';
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

  main.append(assistantPanel, otLive, intel);
  shell.append(hero, jarvisIa, modulePortals, execStrip, main);
  root.append(scene, shell);

  if (typeof window !== 'undefined') {
    window.HNFJarvisPremium = { EVENTS: JARVIS_PREMIUM_EVENTS };
  }

  return root;
}
