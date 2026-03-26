/**
 * Jarvis Day Command — modelo de datos (lógica). UI en `components/jarvis-day-command.js`.
 * Identidad contextual: `jarvis-contextual-identity.js`.
 */

import { buildJarvisCommercialBrain } from './jarvis-commercial-brain.js';
import {
  bandForCategory,
  CHANNEL_ABBR,
  clipText,
  quickViewForRow,
  resolveContextAccent,
} from './jarvis-contextual-identity.js';
import {
  buildClientOperationalMemory,
  buildLiveMemoryGrid,
  buildTemporalOperationalWindows,
  interpretOperativeEvent,
  relativeAgeBadge,
} from './jarvis-operational-interpretation.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

const isOtAbierta = (o) => {
  const st = String(o?.estado || '').toLowerCase();
  return st && !['terminado', 'cerrado', 'cancelado'].includes(st);
};

const isClimaOt = (o) => String(o?.tipoServicio || 'clima') !== 'flota';

export const parseTs = (iso) => {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
};

export function relativeMinutesLabel(iso) {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return '—';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'hace instantes';
  if (m === 1) return 'hace 1 min';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h === 1) return 'hace 1 h';
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function timeHm(iso) {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return '—:—';
  try {
    return new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—:—';
  }
}

function isFresh(iso, windowMs = 12 * 60 * 1000) {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < windowMs;
}

function mapTipoToCategory(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('traslado')) return 'traslado';
  if (t.includes('autoriz') || t.includes('aprob')) return 'aprobacion';
  if (t.includes('cierre') || t.includes('informe') || t.includes('listo_para')) return 'cierre';
  if (t.includes('evidencia')) return 'evidencia';
  if (t.includes('incid')) return 'incidencia';
  if (t.includes('whatsapp') || t.includes('solicitud_cliente')) return 'whatsapp';
  return 'operativo';
}

const CAT_LABEL = {
  whatsapp: 'WhatsApp',
  ot: 'OT',
  traslado: 'Traslado',
  aprobacion: 'Aprobación',
  cierre: 'Cierre',
  evidencia: 'Evidencia',
  incidencia: 'Incidencia',
  operativo: 'Operativo',
};

/**
 * @param {object} ctx
 * @param {object} ctx.data - viewData (operationalPanelDaily, operationalEvents, whatsappFeed, planOts, flotaSolicitudes, operationalCalendar)
 */
export function buildJarvisLiveCommandBrief(ctx) {
  const unified = ctx.unified || {};
  const data = ctx.data || {};
  const alien = ctx.alienDecision || {};
  const friction = ctx.friction || {};
  const cr = friction.capaRealidad || {};
  const execPack = ctx.execPack || {};
  const brief = ctx.brief || {};
  const panel = data.operationalPanelDaily || null;
  const opEvents = Array.isArray(data.operationalEvents) ? data.operationalEvents : [];
  const jEvents = Array.isArray(data.jarvisOperativeEvents) ? data.jarvisOperativeEvents : [];
  const waMsgs = Array.isArray(data.whatsappFeed?.messages) ? data.whatsappFeed.messages : [];
  const flotaSol = Array.isArray(data.flotaSolicitudes) ? data.flotaSolicitudes : unified.flotaSolicitudes || [];
  const calEntries = Array.isArray(data.operationalCalendar?.entries)
    ? data.operationalCalendar.entries
    : Array.isArray(unified.operationalCalendar?.entries)
      ? unified.operationalCalendar.entries
      : [];

  const planOts = Array.isArray(unified.planOts) ? unified.planOts : [];
  const otsAbiertas = planOts.filter((o) => isOtAbierta(o) && isClimaOt(o));
  let otsConHuecoEvidencia = 0;
  let gapSample = '';
  for (const o of otsAbiertas.slice(0, 120)) {
    const g = getEvidenceGaps(o);
    if (g.length) {
      otsConHuecoEvidencia += 1;
      if (!gapSample) gapSample = g[0]?.blockLabel || 'evidencia';
    }
  }

  const cont = panel?.conteos || {};
  const evPen = Array.isArray(panel?.evidencias_pendientes) ? panel.evidencias_pendientes.length : 0;
  const appr = Array.isArray(panel?.autorizaciones_pendientes) ? panel.autorizaciones_pendientes.length : 0;
  const entradasHoy = Number(cont.eventos_hoy) || 0;
  const otsActivasPanel = Number(cont.ots_activas) || otsAbiertas.length;
  const trasladosActivos = Number(cont.traslados_activos) || 0;
  const cierresListos = Array.isArray(panel?.cierres_listos) ? panel.cierres_listos.length : 0;
  const pendInterp =
    (Array.isArray(panel?.entradas_del_dia)
      ? panel.entradas_del_dia.filter((e) => String(e.tipo_evento || '').includes('pendiente'))
      : []
    ).length;

  const bloqueado = Math.round(Number(cr.ingresoBloqueado) || 0);
  const fuga = Math.round(Number(cr.fugaDinero) || 0);
  const proyectado = Math.round(Number(cr.ingresoProyectado) || 0);

  const waClimaRecent = waMsgs.filter((w) => String(w.tipo || '').toLowerCase() !== 'flota');
  const lastWa = [...waClimaRecent].sort((a, b) => {
    const ta = parseTs(a.updatedAt) || parseTs(a.createdAt) || 0;
    const tb = parseTs(b.updatedAt) || parseTs(b.createdAt) || 0;
    return tb - ta;
  })[0];

  const topResp = panel?.responsables_criticos?.[0];
  const topAcc = (alien.top3Acciones || [])[0];
  const criticalResponsible =
    topResp?.responsable ||
    topAcc?.responsable ||
    (execPack.alerts || []).find((x) => x?.responsable)?.responsable ||
    'Asignar dueño en Clima / panel operativo';

  let level = 0;
  if (alien.estadoGlobal === 'critico') level = 2;
  else if (alien.estadoGlobal === 'tension') level = 1;
  if (evPen >= 4 || appr >= 5 || otsConHuecoEvidencia >= 6) level = Math.max(level, 2);
  else if (evPen >= 1 || appr >= 2 || otsConHuecoEvidencia >= 3 || pendInterp >= 2) level = Math.max(level, 1);

  const opName = String(ctx.operatorName || '').trim() || 'Hernan';

  const parts = [];
  if (level >= 2 && (evPen || otsConHuecoEvidencia)) {
    parts.push(
      `la prioridad crítica son evidencias y cierres: ${evPen || 0} evento(s) evidencia + ${otsConHuecoEvidencia} OT con huecos.`
    );
  } else if (level >= 2 && appr) {
    parts.push(`${appr} ítem(s) frenan aprobación — el comando debe despejar cola hoy.`);
  } else if (lastWa && isFresh(lastWa.updatedAt || lastWa.createdAt, 15 * 60 * 1000)) {
    parts.push(
      `ingreso vivo por WhatsApp (${lastWa.cliente || 'cliente'} · ${lastWa.tipo || 'clima'}). Interpretación y vínculo OT en curso.`
    );
  } else if (level >= 1) {
    parts.push(`presión en clima: ${otsActivasPanel} OT activas; caja proyectada ~$${proyectado.toLocaleString('es-CL')}.`);
  } else if (cierresListos > 0) {
    parts.push(`${cierresListos} cierre(s) listo(s) — priorizá cobro y salida al cliente.`);
  } else {
    parts.push(`ritmo controlado: ${entradasHoy} ingresos de eventos hoy · ${trasladosActivos} traslado(s) en curso.`);
  }

  const liveBrief = clipText(`${opName} · ${parts[0]}`, 100);

  let secondary = '';
  if (level >= 1 && alien.focoDelDia) secondary = alien.focoDelDia;
  else if (lastWa) {
    secondary = `Último WhatsApp clima: ${lastWa.cliente || '—'} · ${lastWa.resultadoIngesta || lastWa.estado || '—'}.`;
  }

  let mandatory = '';
  if (otsConHuecoEvidencia && (evPen || otsConHuecoEvidencia >= 2)) {
    mandatory = `Subir evidencias en ${otsConHuecoEvidencia} OT (${gapSample || 'checklist'}) antes de cerrar.`;
  } else if (appr) {
    mandatory = `Gestionar ${appr} aprobación(es) o reasignar con SLA claro.`;
  } else if (lastWa && isFresh(lastWa.updatedAt || lastWa.createdAt, 20 * 60 * 1000)) {
    mandatory = `Validar WhatsApp · ${lastWa.cliente || '—'} · OT ${lastWa.otIdRelacionado || 'sin vínculo'}.`;
  } else {
    mandatory = alien.focoDelDia || 'Mantener evidencia + cobro alineados en OT abiertas.';
  }

  const responseHint =
    level >= 2 ? 'Ventana crítica: 15–30 min.' : level >= 1 ? 'Ventana: 45–90 min.' : 'Sin ventana crítica.';

  const impactLine = `Detenido ~$${bloqueado.toLocaleString('es-CL')} · fuga/riesgo ~$${fuga.toLocaleString('es-CL')}.`;

  const pressureText = level >= 2 ? 'CRÍTICA' : level >= 1 ? 'ELEVADA' : 'CONTROLADA';

  let dominantChannel = 'Operación / sistema';
  if (lastWa && isFresh(lastWa.updatedAt || lastWa.createdAt, 45 * 60 * 1000)) dominantChannel = 'WhatsApp · clima';
  else if (entradasHoy >= 3 && opEvents.length) dominantChannel = 'Eventos operativos (API)';
  else if (Array.isArray(data.outlookFeed?.messages) && data.outlookFeed.messages.length) dominantChannel = 'Correo (intake)';

  const nowMs = Date.now();
  const in2h = nowMs + 2 * 3600000;
  let nextMilestone = 'Sin hito de agenda detectado';
  let nextMilestoneAt = null;
  for (const en of calEntries) {
    const fd = en.fecha || en.date || en.start;
    const hm = en.hora || en.time || '09:00';
    if (!fd) continue;
    const cand = parseTs(`${String(fd).slice(0, 10)}T${String(hm).slice(0, 5)}:00`);
    if (!Number.isFinite(cand) || cand < nowMs) continue;
    if (!nextMilestoneAt || cand < nextMilestoneAt) {
      nextMilestoneAt = cand;
      nextMilestone = `${timeHm(cand)} · ${en.titulo || en.title || en.cliente || 'Agenda'}`;
    }
  }
  if (!nextMilestoneAt && cierresListos) {
    nextMilestone = `Hoy: ${cierresListos} OT lista(s) para salida cliente`;
  }

  const dayTimeline = [];

  const pushRow = (row) => {
    if (!row.ts) return;
    dayTimeline.push(row);
  };

  for (const e of (panel?.entradas_del_dia || []).slice(0, 20)) {
    const at = e.updatedAt || e.createdAt || e.fecha_hora;
    const cat = mapTipoToCategory(e.tipo_evento);
    pushRow({
      id: `op-${e.id}`,
      ts: at,
      timeHm: timeHm(at),
      category: cat,
      typeLabel: CAT_LABEL[cat] || 'Operativo',
      clienteTienda: e.cliente || e.sucursal || e.tienda || '—',
      estado: e.estado || '—',
      impacto: e.urgencia ? `Urg. ${e.urgencia}` : e.aprobacion_requerida ? 'Requiere aprobación' : '—',
      responsable: e.responsable || e.tecnico || '—',
      fresh: isFresh(at),
    });
  }

  for (const e of opEvents.slice(0, 25)) {
    const at = e.updatedAt || e.createdAt || e.fecha_hora;
    const cat = mapTipoToCategory(e.tipo_evento);
    pushRow({
      id: `oe-${e.id}`,
      ts: at,
      timeHm: timeHm(at),
      category: cat,
      typeLabel: CAT_LABEL[cat] || 'Operativo',
      clienteTienda: e.cliente || e.tienda || e.sucursal || '—',
      estado: e.estado || '—',
      impacto: e.urgencia ? String(e.urgencia) : '—',
      responsable: e.responsable || e.tecnico || '—',
      fresh: isFresh(at),
    });
  }

  for (const w of waClimaRecent.slice(0, 12)) {
    const at = w.updatedAt || w.createdAt;
    pushRow({
      id: `wa-${w.id}`,
      ts: at,
      timeHm: timeHm(at),
      category: 'whatsapp',
      typeLabel: 'WhatsApp',
      clienteTienda: w.cliente || w.ubicacion || '—',
      estado: w.estadoOperacional || w.estado || '—',
      impacto: w.impactoNivel ? String(w.impactoNivel) : '—',
      responsable: w.tecnico || '—',
      fresh: isFresh(at),
    });
  }

  for (const o of otsAbiertas.slice(0, 10)) {
    const h = o.historial;
    const last = Array.isArray(h) && h.length ? h[h.length - 1] : null;
    const at = last?.at || o.updatedAt;
    if (!at) continue;
    pushRow({
      id: `ot-${o.id}-${at}`,
      ts: at,
      timeHm: timeHm(at),
      category: 'ot',
      typeLabel: 'OT clima',
      clienteTienda: o.cliente || '—',
      estado: o.estado || '—',
      impacto: getEvidenceGaps(o).length ? 'Evidencia incompleta' : 'En curso',
      responsable: o.tecnicoAsignado || o.contactoTerreno || '—',
      fresh: isFresh(at),
    });
  }

  const trasladoEnCurso = (s) => !['completada', 'cerrada'].includes(String(s?.estado || '').toLowerCase());
  for (const s of flotaSol.filter(trasladoEnCurso).slice(0, 8)) {
    const at = s.updatedAt || s.createdAt;
    if (!at) continue;
    pushRow({
      id: `fl-${s.id}-${at}`,
      ts: at,
      timeHm: timeHm(at),
      category: 'traslado',
      typeLabel: 'Traslado',
      clienteTienda: s.cliente || `${s.origen || ''}→${s.destino || ''}`.slice(0, 40) || '—',
      estado: s.estado || '—',
      impacto: 'Flota',
      responsable: s.conductor || s.responsable || '—',
      fresh: isFresh(at),
    });
  }

  for (const o of (panel?.cierres_listos || []).slice(0, 6)) {
    const at = o.updatedAt || o.cerradoEn || o.creadoEn;
    pushRow({
      id: `ci-${o.id}`,
      ts: at || new Date().toISOString(),
      timeHm: timeHm(at || new Date().toISOString()),
      category: 'cierre',
      typeLabel: 'Cierre listo',
      clienteTienda: o.cliente || '—',
      estado: o.estado || 'terminado',
      impacto: 'Listo cliente / cobro',
      responsable: o.tecnicoAsignado || '—',
      fresh: isFresh(at),
    });
  }

  for (const je of jEvents) {
    const at = je.at;
    if (!at) continue;
    const ji = interpretOperativeEvent(je);
    const tc = String(je.tipoClasificado || '').toLowerCase();
    let cat = 'operativo';
    if (tc.includes('whatsapp')) cat = 'whatsapp';
    else if (tc.includes('incidente')) cat = 'incidencia';
    else if (tc.includes('ot')) cat = 'ot';
    pushRow({
      id: `jv-${je.id}`,
      ts: at,
      timeHm: timeHm(at),
      category: cat,
      typeLabel: `Ingesta · ${ji.tipo_evento}`,
      clienteTienda: ji.cliente_detectado,
      estado: ji.estado_operativo,
      impacto: clipText(ji.impacto_cierre, 52),
      responsable: ji.responsable_sugerido,
      fresh: isFresh(at),
      semaforo: ji.semaforo,
      siguiente_paso: clipText(ji.siguiente_paso, 80),
      ageBadge: relativeAgeBadge(at),
      interpretSource: 'jarvis_centro',
    });
  }

  dayTimeline.sort((a, b) => (parseTs(b.ts) || 0) - (parseTs(a.ts) || 0));
  const seenIds = new Set();
  const dayTimelineDedup = [];
  for (const row of dayTimeline) {
    if (!row.id || seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    dayTimelineDedup.push(row);
  }
  const dayTimelineEnriched = dayTimelineDedup.slice(0, 16).map((r) => ({
    ...r,
    areaBand: bandForCategory(r.category),
    navigateView: quickViewForRow(r.category),
    channelAbbr: CHANNEL_ABBR[r.category] || 'OP',
    ageBadge: r.ageBadge || relativeAgeBadge(r.ts),
    semaforo: r.semaforo || (r.fresh ? 'ambar' : 'verde'),
    siguiente_paso:
      r.siguiente_paso ||
      clipText(`Seguir: ${r.typeLabel} · ${r.clienteTienda || '—'}`, 64),
  }));

  const temporalWindows = buildTemporalOperationalWindows({
    jarvisEvents: jEvents,
    opEvents,
    entradasDia: panel?.entradas_del_dia || [],
    panel,
  });
  const clientMemory = buildClientOperationalMemory(jEvents, planOts, 6);
  const memoryGrid = buildLiveMemoryGrid(jEvents, 5);
  const latestIngestInterpretation = jEvents[0] ? interpretOperativeEvent(jEvents[0]) : null;
  const cerebroPulse = jEvents[0]
    ? {
        estado: jEvents[0].jarvisOperativoBrain?.estado || null,
        semaforo: jEvents[0].jarvisOperativoBrain?.semaforo || latestIngestInterpretation?.semaforo || null,
        prioridad: jEvents[0].jarvisOperativoBrain?.prioridad || null,
      }
    : null;

  let otStale24 = 0;
  let otStale48 = 0;
  let otStale72 = 0;
  for (const o of otsAbiertas.slice(0, 200)) {
    const t = parseTs(o.updatedAt);
    if (!Number.isFinite(t)) continue;
    const age = nowMs - t;
    if (age > 72 * 3600000) otStale72 += 1;
    else if (age > 48 * 3600000) otStale48 += 1;
    else if (age > 24 * 3600000) otStale24 += 1;
  }

  const contextSamples = [
    lastWa?.cliente,
    ...otsAbiertas.slice(0, 6).map((o) => o.cliente),
    panel?.entradas_del_dia?.[0]?.cliente,
    opEvents[0]?.cliente,
  ].filter(Boolean);
  const contextAccent = resolveContextAccent(contextSamples);

  const jarvisTriad = {
    detecta: clipText(parts[0], 88),
    recomienda: clipText(secondary || alien.focoDelDia || 'Cierre con evidencia y cobro alineados.', 88),
    dispara: clipText(mandatory, 88),
  };

  const headline = clipText(parts[0], 76);

  const laneSummaries = [
    {
      key: 'urg',
      label: 'Alertas',
      count: (execPack.alerts || []).length,
      view: 'operacion-control',
      tone: level >= 2 ? 'crit' : level >= 1 ? 'warn' : 'neutral',
    },
    {
      key: 'aprob',
      label: 'Aprobación',
      count: appr,
      view: 'panel-operativo-vivo',
      tone: appr ? 'warn' : 'neutral',
    },
    {
      key: 'cierre',
      label: 'Cierres listos',
      count: cierresListos,
      view: 'clima',
      tone: cierresListos ? 'ok' : 'neutral',
    },
    {
      key: 'ev',
      label: 'Evid. / huecos',
      count: evPen + otsConHuecoEvidencia,
      view: 'clima',
      tone: evPen + otsConHuecoEvidencia > 0 ? 'crit' : 'neutral',
    },
    {
      key: 'ing',
      label: 'Eventos hoy',
      count: entradasHoy,
      view: 'panel-operativo-vivo',
      tone: 'neutral',
    },
    {
      key: 'tr',
      label: 'Traslados',
      count: trasladosActivos,
      view: 'flota',
      tone: trasladosActivos >= 3 ? 'warn' : 'neutral',
    },
    {
      key: 'caja',
      label: bloqueado > 0 ? `~$${Math.round(bloqueado / 1000)}k det.` : 'Caja fluida',
      count: bloqueado > 0 ? 1 : 0,
      view: 'operacion-control',
      tone: bloqueado > 0 ? 'money' : 'neutral',
    },
  ];

  const oppsList = Array.isArray(data.commercialOpportunities)
    ? data.commercialOpportunities
    : Array.isArray(unified.commercialOpportunities)
      ? unified.commercialOpportunities
      : [];
  const comercialPot = Math.round(Number(brief?.comercial?.montoPotencial) || 0);

  const commercialBrain = buildJarvisCommercialBrain({
    unified,
    data,
    friction,
    oppsList,
    operatorName: opName,
    comercialPot,
  });

  const commercialPulse = {
    cliente: clipText(commercialBrain.cliente, 28),
    line: clipText(commercialBrain.propuestaLinea, 76),
    detecta: clipText(commercialBrain.detecta, 88),
    valorEstimado: commercialBrain.valorEstimado,
    servicioLabel: commercialBrain.servicioLabel,
    opportunityId: commercialBrain.opportunityId || null,
    view: 'oportunidades',
    fuente: commercialBrain.fuente,
  };

  const proximas2hLines = [];
  for (const en of calEntries) {
    const fd = en.fecha || en.date;
    const hm = en.hora || en.time || '09:00';
    if (!fd) continue;
    const cand = parseTs(`${String(fd).slice(0, 10)}T${String(hm).slice(0, 5)}:00`);
    if (Number.isFinite(cand) && cand >= nowMs && cand <= in2h) {
      proximas2hLines.push(`${timeHm(cand)} ${en.titulo || en.cliente || 'Evento'}`);
    }
  }
  if (!proximas2hLines.length) proximas2hLines.push('Sin entradas de agenda en 2 h (revisá planificación).');

  const atrasadosLines = [];
  const staleMs = 48 * 3600000;
  for (const o of otsAbiertas.slice(0, 40)) {
    const t = parseTs(o.updatedAt);
    if (Number.isFinite(t) && nowMs - t > staleMs) {
      atrasadosLines.push(`OT ${o.id} · ${o.cliente || '—'} · sin movimiento >48h`);
    }
  }
  for (const e of (panel?.autorizaciones_pendientes || []).slice(0, 5)) {
    const t = parseTs(e.updatedAt || e.createdAt);
    if (Number.isFinite(t) && nowMs - t > 4 * 3600000) {
      atrasadosLines.push(`Aprobación · ${e.cliente || e.tipo_evento || '—'}`);
    }
  }
  if (!atrasadosLines.length) atrasadosLines.push('Sin atrasos fuertes detectados en datos cargados.');

  const aprobLines = (panel?.autorizaciones_pendientes || []).slice(0, 6).map(
    (e) => `${e.cliente || '—'} · ${e.tipo_evento || 'revisión'} · ${e.estado || '—'}`
  );
  if (!aprobLines.length) aprobLines.push('Cola de aprobación vacía en panel diario.');

  const cierreLines = (panel?.cierres_listos || []).slice(0, 6).map(
    (o) => `${o.id} · ${o.cliente || '—'} · listo`
  );
  if (!cierreLines.length) cierreLines.push('Sin OT en “cierre listo” en este snapshot.');

  const riesgoLines = [
    impactLine,
    proyectado ? `Proyectado hoy ~$${proyectado.toLocaleString('es-CL')}` : null,
    otsConHuecoEvidencia ? `${otsConHuecoEvidencia} OT con evidencia incompleta` : null,
  ].filter(Boolean);

  const nuevosLines = [];
  for (const w of waClimaRecent.slice(0, 3)) {
    nuevosLines.push(`WA · ${w.cliente || '—'} · ${relativeMinutesLabel(w.updatedAt || w.createdAt)}`);
  }
  for (const e of (panel?.entradas_del_dia || []).slice(0, 3)) {
    nuevosLines.push(`Evt · ${e.tipo_evento || '—'} · ${relativeMinutesLabel(e.updatedAt || e.createdAt)}`);
  }
  if (!nuevosLines.length) nuevosLines.push('Sin ingresos recientes indexados — sync o registrá manual.');

  const ahoraLines = [mandatory, ...(execPack.alerts || []).slice(0, 2).map((a) => a.texto || a.mensaje || 'Alerta')];
  if (!ahoraLines.filter(Boolean).length) ahoraLines.push('Sin alerta ejecutiva explícita — revisá OT y evidencias.');

  const lanes = {
    ahora: ahoraLines.filter(Boolean),
    proximas2h: proximas2hLines,
    atrasados: atrasadosLines.slice(0, 6),
    aprobacion: aprobLines,
    cierres: cierreLines,
    riesgoCaja: riesgoLines,
    nuevosIngresos: nuevosLines.slice(0, 6),
  };

  const detecta = clipText(parts[0] || 'Sin anomalía en datos sincronizados.', 120);
  const recomienda = clipText(secondary || alien.focoDelDia || 'Mantener ritmo de cierre con evidencia.', 120);
  const urge = mandatory;
  const pierde = clipText(alien.siNoActua || 'Cobro y plazos se dilatan.', 120);
  const dispara = topAcc
    ? clipText(
        `${topAcc.responsable || 'Equipo'}: ${topAcc.accion} (~$${Math.round(Number(topAcc.impactoDinero) || 0).toLocaleString('es-CL')})`,
        120
      )
    : responseHint;

  const jarvisLayers = { detecta, recomienda, urge, pierde, dispara };

  const streamLine = dayTimelineEnriched
    .slice(0, 4)
    .map((r) => `${r.timeHm} ${r.channelAbbr}`)
    .join(' · ');

  const tickerLines = dayTimelineEnriched.map(
    (r) => `${relativeMinutesLabel(r.ts)} · ${r.channelAbbr} · ${r.clienteTienda}`
  );

  return {
    level,
    liveBrief,
    secondaryLine: secondary,
    mandatoryAction: mandatory,
    criticalResponsible,
    responseHint,
    impactLine,
    heldMoney: { bloqueado, fuga, proyectado },
    pressureText,
    dominantChannel,
    nextMilestone,
    nextMilestoneAt: nextMilestoneAt ? new Date(nextMilestoneAt).toISOString() : null,
    topBar: {
      pressureText,
      moneyShort: `~$${bloqueado.toLocaleString('es-CL')}`,
      nextMilestone,
      dominantChannel,
      criticalResponsible,
    },
    dayTimeline: dayTimelineEnriched,
    lanes,
    jarvisLayers,
    jarvisTriad,
    headline,
    laneSummaries,
    commercialPulse,
    commercialBrain,
    gerencialStrip: commercialBrain.gerencial,
    contextAccent,
    streamLine: streamLine || 'Cronología: sin eventos hoy en API — estructura lista para ingesta.',
    tickerLines: tickerLines.length ? tickerLines : ['· Sincronizá para poblar el día.'],
    pulseTiles: [
      { key: 'ingresos', label: 'Ingresos hoy', value: entradasHoy, critical: entradasHoy >= 5 },
      { key: 'ots', label: 'OT activas', value: otsActivasPanel, critical: otsActivasPanel >= 12 },
      { key: 'traslados', label: 'Traslados', value: trasladosActivos, critical: trasladosActivos >= 4 },
      { key: 'evidencias', label: 'Evid. pend.', value: evPen, critical: evPen >= 1 },
      { key: 'aprob', label: 'Aprobaciones', value: appr, critical: appr >= 1 },
      { key: 'cierres', label: 'Cierres listos', value: cierresListos, critical: false },
    ],
    channelIngress: lastWa
      ? {
          canal: 'WhatsApp · reportes clima',
          at: lastWa.updatedAt || lastWa.createdAt,
          cliente: lastWa.cliente,
          tienda: lastWa.ubicacion || lastWa.parsedData?.ubicacion,
          tipoEvento: lastWa.tipo || 'clima',
          estadoInterpretacion: lastWa.resultadoIngesta || (lastWa.procesado ? 'registrado' : 'pendiente'),
          otId: lastWa.otIdRelacionado,
        }
      : null,
    comercialPot,
    alertsN: (execPack.alerts || []).length,
    temporalWindows,
    clientMemory,
    latestIngestInterpretation,
    otStaleCounts: { h24: otStale24, h48: otStale48, h72: otStale72 },
    memoryGrid,
    cerebroPulse,
  };
}
