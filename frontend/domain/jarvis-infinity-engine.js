/**
 * Jarvis Infinity — estado persistente de eventos operativos, presión temporal y control vivo.
 * Regla: un evento no se borra; pasa a resuelto y queda en historial recortado.
 */

import {
  enrichOperationalEvent,
  extractEmailsFromText,
  extractPhonesFromText,
  formatTraceableHeadline,
  inferSourceMeta,
} from './jarvis-event-traceability.js';
import { enrichChannelOperationalLayer } from './jarvis-channel-intelligence.js';

const LS_KEY = 'hnf_jarvis_infinity_v1';
const V = '1';
const MAX_RESUELTOS = 48;
const STALE_HOURS_SIN_MOVIMIENTO = 4;

const readStore = () => {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (!r) return { v: V, events: [] };
    const p = JSON.parse(r);
    return p?.events ? p : { v: V, events: [] };
  } catch {
    return { v: V, events: [] };
  }
};

const writeStore = (events) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ v: V, events }));
  } catch {
    /* ignore */
  }
};

const hashLite = (s) =>
  String(s || '')
    .split('')
    .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
    .toString(36);

const hoursBetween = (t0, t1) => (t1 - t0) / 3600000;

const traceFromLive = (L) => {
  const body = `${L.descripcion || ''} ${L.impacto || ''} ${L.accion || ''}`;
  const meta = inferSourceMeta(L.stableKey, L.origen);
  const phones = extractPhonesFromText(body);
  const emails = extractEmailsFromText(body);
  const base = { ...L, ...meta, channel_id: L.channel_id };
  const ch = enrichChannelOperationalLayer(base);
  return {
    ...meta,
    contact_phone: phones[0] || L.contact_phone || '',
    contact_email: emails[0] || L.contact_email || '',
    channel_id: ch.channel_id || L.channel_id || '',
    channel_name: ch.channel_name,
    channel_kind: ch.channel_kind,
    channel_function: ch.channel_function,
    channel_client: ch.channel_client,
    event_kind: ch.event_kind,
    operational_badge: ch.operational_badge,
  };
};

const pressureTier = (hoursDetected) => {
  if (hoursDetected < 1) return { id: 'normal', label: 'NORMAL', ui: 'normal' };
  if (hoursDetected <= 6) return { id: 'alerta', label: 'ALERTA', ui: 'alerta' };
  return { id: 'critico', label: 'CRÍTICO', ui: 'critico' };
};

/**
 * @param {string} stableKey
 */
export function markJarvisInfinityEventResolved(stableKey) {
  const key = String(stableKey || '').trim();
  if (!key) return;
  const { events } = readStore();
  const now = new Date().toISOString();
  const next = events.map((e) =>
    e.stableKey === key && e.status === 'activo'
      ? { ...e, status: 'resuelto', resolvedAt: now, resolvedReason: 'manual' }
      : e
  );
  writeStore(next);
}

function trimResueltos(events) {
  const activos = events.filter((e) => e.status === 'activo');
  const res = events.filter((e) => e.status === 'resuelto').sort((a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt)));
  return [...activos, ...res.slice(0, MAX_RESUELTOS)];
}

/**
 * @param {object} opts
 * @param {object} opts.brain - buildJarvisOperationalBrain
 * @param {boolean} opts.dataVacuum
 * @param {number} [opts.montoComercialPotencial]
 */
export function syncJarvisInfinityState({ brain, dataVacuum, montoComercialPotencial = 0 }) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { events: prev } = readStore();

  const live = [];
  if (dataVacuum) {
    live.push({
      stableKey: 'data_vacuum',
      origen: 'Sistema',
      descripcion: 'Faltan datos críticos para decidir con confianza',
      impacto: 'Ceguera operativa parcial',
      accion: String(brain?.presencia?.instruccion || '').slice(0, 220) || 'Cargar OT, correo, calendario u oportunidades.',
      prioridad: 'CRITICO',
      assignee: 'Hernan',
    });
  }
  for (const ev of brain?.eventosOperativos || []) {
    live.push({
      stableKey: ev.stableKey,
      origen: ev.origen,
      descripcion: ev.descripcion,
      impacto: ev.impacto,
      accion: ev.accion,
      prioridad: ev.prioridad,
      assignee: ev.sinResponsable ? null : ev.assignee,
      channel_id: ev.channel_id || null,
    });
  }

  const liveKeys = new Set(live.map((x) => x.stableKey));
  let events = prev.map((e) => ({ ...e }));

  for (const e of events) {
    if (e.status !== 'activo') continue;
    if (!liveKeys.has(e.stableKey)) {
      e.status = 'resuelto';
      e.resolvedAt = nowIso;
      e.resolvedReason = 'condición ya no detectada';
    }
  }

  for (const L of live) {
    const contentHash = hashLite(`${L.descripcion}|${L.impacto}|${L.accion}`);
    const existing = events.find((x) => x.stableKey === L.stableKey && x.status === 'activo');
    if (!existing) {
      const tr = traceFromLive(L);
      events.push({
        id: `evt_${L.stableKey}`,
        stableKey: L.stableKey,
        origen: L.origen,
        descripcion: L.descripcion,
        impacto: L.impacto,
        accion: L.accion,
        prioridad: L.prioridad,
        assignee: L.assignee,
        status: 'activo',
        detectedAt: nowIso,
        lastSeenAt: nowIso,
        contentHash,
        sinMovimiento: false,
        escalado: false,
        resolvedAt: null,
        resolvedReason: null,
        source_type: tr.source_type,
        source_ref: tr.source_ref,
        source_label: tr.source_label,
        source_url: tr.source_url,
        contact_phone: tr.contact_phone,
        contact_email: tr.contact_email,
        channel_id: tr.channel_id,
        channel_name: tr.channel_name,
        channel_kind: tr.channel_kind,
        channel_function: tr.channel_function,
        channel_client: tr.channel_client,
        event_kind: tr.event_kind,
        operational_badge: tr.operational_badge,
      });
    } else {
      const prevHash = existing.contentHash;
      const tr = traceFromLive(L);
      existing.descripcion = L.descripcion;
      existing.impacto = L.impacto;
      existing.accion = L.accion;
      existing.prioridad = L.prioridad;
      existing.assignee = L.assignee;
      existing.lastSeenAt = nowIso;
      existing.source_type = tr.source_type;
      existing.source_ref = tr.source_ref;
      existing.source_label = tr.source_label;
      existing.source_url = tr.source_url;
      if (tr.contact_phone) existing.contact_phone = tr.contact_phone;
      if (tr.contact_email) existing.contact_email = tr.contact_email;
      existing.channel_id = tr.channel_id || existing.channel_id;
      existing.channel_name = tr.channel_name || existing.channel_name;
      existing.channel_kind = tr.channel_kind || existing.channel_kind;
      existing.channel_function = tr.channel_function || existing.channel_function;
      existing.channel_client = tr.channel_client || existing.channel_client;
      existing.event_kind = tr.event_kind || existing.event_kind;
      existing.operational_badge = tr.operational_badge || existing.operational_badge;
      const det = new Date(existing.detectedAt).getTime();
      const hoursDet = hoursBetween(det, now);
      const sinMov =
        hoursDet >= STALE_HOURS_SIN_MOVIMIENTO && prevHash === contentHash;
      existing.sinMovimiento = sinMov;
      existing.contentHash = contentHash;
      if (sinMov && !existing.escalado) existing.escalado = true;
    }
  }

  events = trimResueltos(events);
  writeStore(events);

  const activos = events.filter((e) => e.status === 'activo');
  const sinResponsable = activos.filter((e) => !String(e.assignee || '').trim());

  const presion = activos.map((e) => {
    const h = hoursBetween(new Date(e.detectedAt).getTime(), now);
    const tier = pressureTier(h);
    const ext = enrichOperationalEvent(e);
    return {
      stableKey: e.stableKey,
      titulo: e.descripcion,
      tituloDisplay: formatTraceableHeadline(ext),
      impacto: e.impacto,
      tiempoLabel: h < 1 ? '< 1h' : h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`,
      horas: h,
      nivel: tier.label,
      nivelUi: tier.ui,
      sinMovimiento: Boolean(e.sinMovimiento),
      assignee: e.assignee || '—',
    };
  });

  const anyPresionCritica = presion.some((p) => p.nivelUi === 'critico');
  const anyPresionAlerta = presion.some((p) => p.nivelUi === 'alerta');

  const criticalKeys = new Set();
  for (const e of activos) {
    if (e.prioridad === 'CRITICO') criticalKeys.add(e.stableKey);
  }
  for (const p of presion) {
    if (p.nivelUi === 'critico') criticalKeys.add(p.stableKey);
  }
  const tareasCriticas = criticalKeys.size;

  const estadoBrain = String(brain?.presencia?.estado || 'NORMAL');
  let semaforo = 'verde';
  let estadoLabel = 'VERDE · Flujo operativo';
  if (
    sinResponsable.length > 0 ||
    estadoBrain === 'CRITICO' ||
    anyPresionCritica ||
    (dataVacuum && liveKeys.has('data_vacuum'))
  ) {
    semaforo = 'rojo';
    estadoLabel = 'ROJO · BLOQUEO / PRESIÓN MÁXIMA';
  } else if (estadoBrain === 'ALTO' || anyPresionAlerta || activos.filter((e) => e.prioridad === 'ALTO').length >= 2) {
    semaforo = 'amarillo';
    estadoLabel = 'AMARILLO · RIESGO ACTIVO';
  }

  const baseRiesgo = Number(brain?.presencia?.dineroRiesgoVivo) || 0;
  const extraComercial =
    liveKeys.has('oportunidades_vacio') && montoComercialPotencial > 0
      ? Math.round(Number(montoComercialPotencial) * 0.08)
      : 0;
  const dineroRiesgo = Math.round(baseRiesgo + extraComercial);

  const accionRequerida = activos.length > 0 || semaforo !== 'verde';

  const controlVivo = {
    semaforo,
    estadoLabel,
    dineroRiesgo,
    tareasCriticas: Math.min(99, tareasCriticas),
    pendientes: activos.length,
    accionRequerida,
  };

  return {
    controlVivo,
    eventosActivos: activos,
    eventosHistorial: events.filter((e) => e.status === 'resuelto').slice(0, 12),
    presion,
    sinResponsable,
    markResolved: markJarvisInfinityEventResolved,
  };
}
