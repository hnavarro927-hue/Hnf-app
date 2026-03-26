/**
 * HNF FLOW CONTROL — capa directiva: eventos operativos → estado → riesgo → decisiones.
 * No persiste historial en servidor: deriva eventos del snapshot de datos cargados.
 */

export const HNF_FLOW_CONTROL_VERSION = '2026-03-22';

const OT_DETENIDA_DIAS = 7;
const PERMISO_SIN_RESPUESTA_HORAS = 48;
const FLOTA_RUTA_STALE_HORAS = 48;
const TEC_REPORTE_WA_HORAS = 36;
const WA_RECENT_HORAS = 72;

const pad2 = (n) => String(n).padStart(2, '0');

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const s = String(raw);
  const t = new Date(s).getTime();
  if (Number.isFinite(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00`).getTime();
  return NaN;
};

const diasDesde = (isoOrYmd) => {
  const t = parseTs(isoOrYmd);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
};

const horasDesde = (iso) => {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 3600000;
};

const normalizeEventDate = (x) => {
  const s = String(x || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T12:00:00`;
  if (s) return s;
  return new Date().toISOString();
};

/** @param {object} partial */
export function createOperationalEvent(partial) {
  return {
    id: partial.id,
    tipo_evento: partial.tipo_evento,
    origen: partial.origen,
    cliente: partial.cliente ?? null,
    referenciaId: partial.referenciaId,
    fecha: partial.fecha,
    estado: partial.estado,
    criticidad: partial.criticidad,
    requiereAccion: Boolean(partial.requiereAccion),
  };
}

/**
 * Transforma datos ERP + WhatsApp (+ Outlook futuro) en eventos operativos normalizados.
 * @param {object} viewData
 * @returns {ReturnType<typeof createOperationalEvent>[]}
 */
export function buildOperationalEventsFromViewData(viewData) {
  const events = [];
  const nowIso = new Date().toISOString();

  const rawOts = viewData?.ots?.data ?? viewData?.ots ?? [];
  const ots = Array.isArray(rawOts) ? rawOts : [];
  const otsClima = ots.filter(isOtClima);

  for (const o of otsClima) {
    const baseFecha = o.creadoEn || o.createdAt || o.fecha || nowIso.slice(0, 10);
    const stale = diasDesde(baseFecha);

    if (o.estado === 'pendiente' || o.estado === 'en proceso') {
      events.push(
        createOperationalEvent({
          id: `erp-ot-pipeline-${o.id}`,
          tipo_evento: 'ot_creada',
          origen: 'erp',
          cliente: o.cliente || null,
          referenciaId: o.id,
          fecha: normalizeEventDate(baseFecha),
          estado: o.estado,
          criticidad: stale != null && stale > OT_DETENIDA_DIAS ? 'alta' : 'media',
          requiereAccion: stale != null && stale > OT_DETENIDA_DIAS,
        })
      );
    }

    if (o.estado === 'terminado') {
      const sinCosto = roundMoney(o.costoTotal) <= 0;
      const sinPdf = !o.pdfUrl || !String(o.pdfUrl).trim();
      const sinCobro = sinPdf ? false : roundMoney(o.montoCobrado) <= 0;
      const gap = sinCosto || sinPdf || sinCobro;
      events.push(
        createOperationalEvent({
          id: `erp-ot-term-${o.id}`,
          tipo_evento: 'ot_terminada',
          origen: 'erp',
          cliente: o.cliente || null,
          referenciaId: o.id,
          fecha: o.cerradoEn || o.updatedAt || baseFecha,
          estado: o.estado,
          criticidad: gap ? 'alta' : 'baja',
          requiereAccion: gap,
        })
      );
    }
  }

  const flotaList = Array.isArray(viewData?.flotaSolicitudes) ? viewData.flotaSolicitudes : [];
  for (const s of flotaList) {
    const est = String(s.estado || '');
    const ref = s.updatedAt || s.createdAt || (s.fecha ? `${s.fecha}T12:00:00` : nowIso);
    const h = horasDesde(ref);

    if (est === 'recibida') {
      events.push(
        createOperationalEvent({
          id: `erp-sol-rec-${s.id}`,
          tipo_evento: 'cliente_solicitud',
          origen: 'erp',
          cliente: s.cliente || null,
          referenciaId: s.id,
          fecha: ref,
          estado: est,
          criticidad: h > PERMISO_SIN_RESPUESTA_HORAS ? 'media' : 'baja',
          requiereAccion: h > PERMISO_SIN_RESPUESTA_HORAS,
        })
      );
    }

    if (est === 'evaluacion' || est === 'cotizada') {
      events.push(
        createOperationalEvent({
          id: `erp-permiso-pend-${s.id}`,
          tipo_evento: 'permiso_solicitado',
          origen: 'erp',
          cliente: s.cliente || null,
          referenciaId: s.id,
          fecha: ref,
          estado: est,
          criticidad: h > PERMISO_SIN_RESPUESTA_HORAS ? 'alta' : 'media',
          requiereAccion: h > PERMISO_SIN_RESPUESTA_HORAS,
        })
      );
    }

    if (est === 'aprobada') {
      events.push(
        createOperationalEvent({
          id: `erp-permiso-ok-${s.id}`,
          tipo_evento: 'permiso_aprobado',
          origen: 'erp',
          cliente: s.cliente || null,
          referenciaId: s.id,
          fecha: ref,
          estado: est,
          criticidad: h > PERMISO_SIN_RESPUESTA_HORAS ? 'media' : 'baja',
          requiereAccion: h > PERMISO_SIN_RESPUESTA_HORAS,
        })
      );
    }
  }

  const wf = viewData?.whatsappFeed;
  const waMsgs = Array.isArray(wf?.messages) ? wf.messages : [];
  const cutoff = Date.now() - WA_RECENT_HORAS * 3600000;
  for (const m of waMsgs) {
    const ts = new Date(m.updatedAt || m.createdAt || 0).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const crit =
      m.impactoNivel === 'critico' ? 'alta' : m.impactoNivel === 'correcto' ? 'baja' : 'media';
    events.push(
      createOperationalEvent({
        id: `wa-msg-${m.id}`,
        tipo_evento: 'mensaje_tecnico',
        origen: 'whatsapp',
        cliente: m.cliente || null,
        referenciaId: m.id,
        fecha: new Date(ts).toISOString(),
        estado: m.estadoOperacional || m.estado || 'ingestado',
        criticidad: crit,
        requiereAccion: Boolean((m.errores || []).length || m.impactoNivel === 'critico'),
      })
    );
  }

  const outlook = viewData?.outlookFeed;
  if (Array.isArray(outlook?.events)) {
    for (const e of outlook.events) {
      events.push(
        createOperationalEvent({
          id: `out-${e.id || Math.random()}`,
          tipo_evento: e.tipo_evento || 'cliente_solicitud',
          origen: 'outlook',
          cliente: e.cliente ?? null,
          referenciaId: String(e.id || ''),
          fecha: e.fecha || nowIso,
          estado: e.estado || 'recibido',
          criticidad: e.criticidad || 'baja',
          requiereAccion: Boolean(e.requiereAccion),
        })
      );
    }
  }

  const techDocs = Array.isArray(viewData?.technicalDocuments) ? viewData.technicalDocuments : [];
  for (const d of techDocs) {
    const ref = d.updatedAt || d.createdAt || nowIso;
    const est = d.estadoDocumento || 'borrador';
    const h = horasDesde(ref);
    const staleRev = est === 'en_revision' && h > 72;
    const staleObs = est === 'observado' && h > 120;
    events.push(
      createOperationalEvent({
        id: `erp-doc-${d.id}`,
        tipo_evento: 'documento_tecnico',
        origen: 'erp',
        cliente: d.cliente || null,
        referenciaId: d.id,
        fecha: normalizeEventDate(ref),
        estado: est,
        criticidad: staleObs ? 'alta' : staleRev || est === 'observado' ? 'media' : 'baja',
        requiereAccion: staleRev || staleObs || est === 'observado',
      })
    );
  }

  return events;
}

/**
 * Un solo evento (API pedida como `updateOperationalState(event)`).
 * @param {ReturnType<typeof createOperationalEvent>} event
 */
export function updateOperationalStateFromEvent(event, viewData = null, snapshot = null) {
  return updateOperationalState([event], viewData, snapshot);
}

/**
 * Reduce eventos al estado operacional global (cuellos de botella, retrasos).
 * @param {ReturnType<typeof createOperationalEvent>[]} events
 * @param {object} [viewData]
 * @param {object} [snapshot] - getOperationalSnapshot (opcional, para totales alineados)
 */
export function updateOperationalState(events, viewData = null, snapshot = null) {
  const porTipo = {};
  const porOrigen = {};
  let requiereAccion = 0;

  for (const e of events) {
    porTipo[e.tipo_evento] = (porTipo[e.tipo_evento] || 0) + 1;
    porOrigen[e.origen] = (porOrigen[e.origen] || 0) + 1;
    if (e.requiereAccion) requiereAccion += 1;
  }

  const cuellosDeBotella = [];
  if ((porTipo.permiso_solicitado || 0) >= 3) {
    cuellosDeBotella.push('Múltiples permisos / cotizaciones pendientes de respuesta del cliente.');
  }
  if ((porTipo.ot_creada || 0) >= 8) {
    cuellosDeBotella.push('Alto volumen de OT abiertas en Clima (pipeline saturado).');
  }
  if (snapshot?.clima && snapshot.clima.pendientes + snapshot.clima.enProceso > 12) {
    cuellosDeBotella.push('Cola de visitas Clima por encima del umbral operativo.');
  }
  if (snapshot?.flota?.pendientes > 6) {
    cuellosDeBotella.push('Pipeline de flota temprano (recibida / evaluación) congestionado.');
  }

  const retrasos = buildRetrasosCriticos(viewData, snapshot);

  return {
    lastUpdated: new Date().toISOString(),
    totalEventos: events.length,
    porTipo,
    porOrigen,
    eventosQueRequierenAccion: requiereAccion,
    cuellosDeBotella,
    retrasos,
  };
}

function buildRetrasosCriticos(viewData, snapshot) {
  const out = [];
  const rawOts = viewData?.ots?.data ?? viewData?.ots ?? [];
  const ots = Array.isArray(rawOts) ? rawOts : [];
  const otsClima = ots.filter(isOtClima);

  for (const o of otsClima) {
    if (o.estado === 'terminado') continue;
    const base = o.creadoEn || o.createdAt || o.fecha;
    const d = diasDesde(base);
    if (d != null && d > OT_DETENIDA_DIAS) {
      out.push({
        tipo: 'ot_abierta',
        modulo: 'clima',
        referenciaId: o.id,
        cliente: o.cliente,
        dias: d,
        descripcion: `OT ${o.id} abierta ${d} días`,
      });
    }
  }

  const flotaList = Array.isArray(viewData?.flotaSolicitudes) ? viewData.flotaSolicitudes : [];
  for (const s of flotaList) {
    const est = String(s.estado || '');
    const ref = s.updatedAt || s.createdAt || (s.fecha ? `${s.fecha}T12:00:00` : '');
    const h = horasDesde(ref);
    if ((est === 'evaluacion' || est === 'cotizada') && h > PERMISO_SIN_RESPUESTA_HORAS) {
      out.push({
        tipo: 'permiso',
        modulo: 'flota',
        referenciaId: s.id,
        cliente: s.cliente,
        horas: Math.round(h),
        descripcion: `Flota ${s.id} en ${est} hace ~${Math.round(h)} h`,
      });
    }
    if (est === 'en_ruta' && h > FLOTA_RUTA_STALE_HORAS) {
      out.push({
        tipo: 'flota_ruta',
        modulo: 'flota',
        referenciaId: s.id,
        cliente: s.cliente,
        horas: Math.round(h),
        descripcion: `En ruta sin actualización reciente (~${Math.round(h)} h)`,
      });
    }
  }

  if (snapshot?.planificacion?.atrasadas > 0) {
    out.push({
      tipo: 'plan',
      modulo: 'planificacion',
      referenciaId: '—',
      descripcion: `${snapshot.planificacion.atrasadas} mantención(es) atrasada(s)`,
    });
  }

  return out.slice(0, 40);
}

/**
 * @param {ReturnType<typeof createOperationalEvent>[]} events
 * @param {object} viewData
 * @param {object|null} snapshot
 */
export function detectOperationalRisk(events, viewData, snapshot) {
  void events;
  /** @type {Array<{ code: string, mensaje: string, criticidad: 'baja'|'media'|'alta', modulo: string, referenciaId?: string, count?: number, horas?: number }>} */
  const risks = [];
  const push = (x) => risks.push(x);

  const retrasos = buildRetrasosCriticos(viewData, snapshot);
  for (const r of retrasos) {
    if (r.tipo === 'ot_abierta') {
      push({
        code: 'OT_DETENIDA',
        mensaje: r.descripcion,
        criticidad: 'alta',
        modulo: 'clima',
        referenciaId: r.referenciaId,
        horas: (r.dias || 0) * 24,
      });
    } else if (r.tipo === 'permiso') {
      push({
        code: 'PERMISO_SIN_RESPUESTA',
        mensaje: r.descripcion,
        criticidad: 'alta',
        modulo: 'flota',
        referenciaId: r.referenciaId,
        horas: r.horas,
      });
    } else if (r.tipo === 'flota_ruta') {
      push({
        code: 'FLOTA_RUTA_RETRASADA',
        mensaje: r.descripcion,
        criticidad: 'media',
        modulo: 'flota',
        referenciaId: r.referenciaId,
        horas: r.horas,
      });
    } else if (r.tipo === 'plan') {
      push({
        code: 'PLAN_ATRASO',
        mensaje: r.descripcion,
        criticidad: 'media',
        modulo: 'planificacion',
      });
    }
  }

  if (snapshot?.clima) {
    const n = snapshot.clima.sinCostos + snapshot.clima.noCobradas;
    if (n > 0) {
      push({
        code: 'CIERRE_FINANCIERO_OT',
        mensaje: 'OT terminadas con economía incompleta (costo / cobro / PDF)',
        criticidad: 'alta',
        modulo: 'clima',
        count: n,
      });
    }
  }

  const wf = viewData?.whatsappFeed;
  const waMsgs = Array.isArray(wf?.messages) ? wf.messages : [];
  let lastTs = 0;
  for (const m of waMsgs) {
    const t = new Date(m.updatedAt || m.createdAt || 0).getTime();
    if (Number.isFinite(t)) lastTs = Math.max(lastTs, t);
  }
  const hWa = lastTs ? (Date.now() - lastTs) / 3600000 : Infinity;
  const abierta =
    snapshot?.clima && snapshot.clima.pendientes + snapshot.clima.enProceso > 0;
  if (abierta && hWa > TEC_REPORTE_WA_HORAS) {
    push({
      code: 'REPORTE_WA_DEBIL',
      mensaje: `Sin actividad reciente en ingesta WhatsApp (~${Math.round(hWa)} h) con OT abiertas en Clima`,
      criticidad: 'media',
      modulo: 'whatsapp',
      horas: Math.round(hWa),
    });
  }

  const techSilence = new Map();
  for (const m of waMsgs) {
    const tid = m.tecnicoId || '—';
    const t = new Date(m.updatedAt || m.createdAt || 0).getTime();
    if (!Number.isFinite(t)) continue;
    if (!techSilence.has(tid) || t > techSilence.get(tid)) techSilence.set(tid, t);
  }
  let techRiskN = 0;
  for (const [tid, ts] of techSilence) {
    if (tid === 'tecnico_no_identificado' || tid === '—') continue;
    const h = (Date.now() - ts) / 3600000;
    if (h > TEC_REPORTE_WA_HORAS * 2) {
      push({
        code: 'TECNICO_SIN_REPORTE',
        mensaje: `Técnico ${tid} sin mensajes en WhatsApp recientes (~${Math.round(h)} h)`,
        criticidad: 'media',
        modulo: 'whatsapp',
        referenciaId: tid,
        horas: Math.round(h),
      });
      techRiskN += 1;
      if (techRiskN >= 5) break;
    }
  }

  return risks;
}

/**
 * @param {ReturnType<typeof updateOperationalState>} state
 * @param {ReturnType<typeof detectOperationalRisk>} risks
 * @param {Array<{ tipo: string, mensaje: string, accion: string, code: string, count?: number }>} intelIssues
 * @param {Array<{ tipo: string, codigo: string, titulo: string, descripcion?: string, accionCorta?: string, nav?: object }>} executionQueue
 */
export function decideNextActions(state, risks, intelIssues = [], executionQueue = []) {
  const alertasCriticas = [];

  const seenAlert = new Set();
  for (const r of risks) {
    if (r.criticidad !== 'alta') continue;
    const k = r.code + (r.referenciaId || '');
    if (seenAlert.has(k)) continue;
    seenAlert.add(k);
    alertasCriticas.push({
      fuente: 'riesgo',
      code: r.code,
      texto: r.mensaje,
      modulo: r.modulo,
      referenciaId: r.referenciaId,
      prioridad: 1,
    });
  }
  for (const i of intelIssues) {
    if (i.tipo !== 'CRITICO') continue;
    if (seenAlert.has(i.code)) continue;
    seenAlert.add(i.code);
    alertasCriticas.push({
      fuente: 'intel',
      code: i.code,
      texto: i.mensaje,
      modulo: i.modulo,
      accion: i.accion,
      count: i.count,
      prioridad: 0,
    });
  }
  alertasCriticas.sort((a, b) => a.prioridad - b.prioridad);

  const bloqueos = [];
  const bloqueoCodes = new Set(['CLIM_SIN_COSTO', 'CLIM_SIN_COBRO', 'FLO_SIN_INGRESO', 'FIN_UTIL_NEG', 'OT_DETENIDA', 'CIERRE_FINANCIERO_OT']);
  for (const i of intelIssues) {
    if (bloqueoCodes.has(i.code)) {
      bloqueos.push({ fuente: 'intel', code: i.code, texto: i.mensaje, accion: i.accion, count: i.count });
    }
  }
  for (const r of risks) {
    if (r.criticidad === 'alta' && ['OT_DETENIDA', 'PERMISO_SIN_RESPUESTA', 'CIERRE_FINANCIERO_OT'].includes(r.code)) {
      const k = `r:${r.code}:${r.referenciaId || ''}`;
      if (bloqueos.some((b) => b.texto === r.mensaje)) continue;
      bloqueos.push({ fuente: 'riesgo', code: r.code, texto: r.mensaje, modulo: r.modulo, referenciaId: r.referenciaId });
    }
  }

  const accionesPrioritarias = [];
  const seenAct = new Set();
  for (const item of executionQueue) {
    const k = `${item.codigo}:${item.refKey || item.titulo}`;
    if (seenAct.has(k)) continue;
    seenAct.add(k);
    accionesPrioritarias.push({
      prioridad: item.tipo === 'CRITICO' ? 1 : 2,
      titulo: item.titulo || item.accionCorta,
      detalle: item.descripcion || item.accionCorta,
      codigo: item.codigo,
      modulo: item.modulo,
      nav: item.nav || null,
    });
  }
  for (const a of alertasCriticas.slice(0, 6)) {
    if (a.fuente !== 'intel' || !a.accion) continue;
    const k = `alt:${a.code}`;
    if (seenAct.has(k)) continue;
    seenAct.add(k);
    accionesPrioritarias.push({
      prioridad: 0,
      titulo: a.texto,
      detalle: a.accion,
      codigo: a.code,
      modulo: a.modulo,
      nav: null,
    });
  }
  accionesPrioritarias.sort((a, b) => a.prioridad - b.prioridad);

  return {
    accionesPrioritarias: accionesPrioritarias.slice(0, 14),
    alertasCriticas: alertasCriticas.slice(0, 14),
    bloqueos,
    resumen: {
      cuellos: state.cuellosDeBotella,
      eventosAccion: state.eventosQueRequierenAccion,
    },
  };
}

/**
 * Paquete listo para panel directivo + integración con Intelligence (caller pasa snapshot/issues/cola).
 */
export function collectFlowDirectorSummary(viewData, snapshot, intelIssues, executionQueue) {
  const events = buildOperationalEventsFromViewData(viewData);
  const state = updateOperationalState(events, viewData, snapshot);
  const risks = detectOperationalRisk(events, viewData, snapshot);
  const decision = decideNextActions(state, risks, intelIssues, executionQueue);
  return {
    version: HNF_FLOW_CONTROL_VERSION,
    events,
    state,
    risks,
    decision,
  };
}
