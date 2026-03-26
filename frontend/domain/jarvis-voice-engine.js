/**
 * Voz ejecutiva — respuestas y briefs sin relleno.
 */

import { getInboundMeaningOnly } from './jarvis-memory.js';

export const JARVIS_VOICE_VERSION = '2026-03-24';

/**
 * @param {object} unified
 */
export function buildJarvisDataRequests(unified) {
  const u = unified || {};
  const out = [];
  const msgs = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages.length : 0;
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities.length : 0;
  const ots = Array.isArray(u.planOts) ? u.planOts.length : 0;
  const docs = Array.isArray(u.technicalDocuments) ? u.technicalDocuments.length : 0;
  const vault = Array.isArray(u.historicalVault?.records) ? u.historicalVault.records.length : 0;
  const wa = u.whatsappFeed?.messages;
  const waN = Array.isArray(wa) ? wa.length : 0;

  if (opps < 2) {
    out.push('Necesito densidad de pipeline (≥3 oportunidades con dueño) para calcular palanca real del mes.');
  }
  if (!msgs) {
    out.push('Falta correo reciente analizado para validar cuellos de seguimiento con cliente.');
  }
  if (!waN) {
    out.push('No tengo WhatsApp trazado: si cerrás acuerdos ahí, volcá nota a OT o pegá export en ingesta.');
  }
  if (!ots) {
    out.push('Sin OT en vista no anclo cobro a hechos: sincronizá datos operativos o pegá export mínimo.');
  }
  if (!docs) {
    out.push('Sin documentos técnicos ingestados sube el riesgo de cierre sin evidencia — activá ingesta de docs.');
  }
  if (vault < 20) {
    out.push('La memoria histórica es baja; cargar enero/febrero y más meses en Vault mejora patrones de cliente y riesgo.');
  } else if (vault < 50) {
    out.push('Falta densidad de historial: más meses en Vault refinan lectura de riesgo y comportamiento de cliente.');
  }
  const recentImg = getInboundMeaningOnly(6).filter((x) => x.canal === 'imagen').length;
  if (!recentImg) {
    out.push('Necesito imágenes recientes para validar riesgo técnico real en terreno.');
  }
  if (opps < 2 && (ots > 0 || msgs > 0)) {
    out.push('No tengo suficiente contexto comercial para traducir cada señal técnica en oportunidad sin pipeline cargado.');
  }
  if (!out.length) {
    out.push('Señal suficiente para ventana actual: mantené ingesta antes del cierre de día.');
  }
  out.push('Puedo clasificar archivos sueltos, pero necesito tu confirmación para integrarlos al histórico oficial.');
  const uniq = [];
  const seen = new Set();
  for (const s of out) {
    if (!seen.has(s)) {
      seen.add(s);
      uniq.push(s);
    }
  }
  return {
    version: JARVIS_VOICE_VERSION,
    solicitudes: uniq.slice(0, 8),
  };
}

/**
 * Narrativa inmediata post-ingesta (voz + bullets ejecutivos).
 * @param {{ results?: object[], textClassification?: object, committed?: boolean }} payload
 */
export function buildIntakeSalidaJarvis(payload) {
  const p = payload || {};
  const results = Array.isArray(p.results) ? p.results : [];
  const committed = Boolean(p.committed);
  const hasImage = results.some((r) => r.kind === 'imagen' && r.imageIntel?.ok !== false);
  const voz = [];
  if (hasImage) {
    voz.push('Jarvis recibió una evidencia visual.');
    voz.push('Detecto señal técnica con impacto operativo.');
    voz.push('Esto no es solo una foto: puede convertirse en riesgo, OT o venta.');
  } else if (results.length) {
    voz.push('Jarvis recibió material operativo y lo clasificó en canales internos.');
  } else if (p.textClassification) {
    voz.push('Jarvis leyó el texto pegado y extrajo canal, riesgo y palanca sugerida.');
  }
  if (!voz.length) voz.push('Listo para analizar: cargá texto, archivo o imagen y pulsá Analizar ingreso.');

  const first = results[0];
  const c = first?.classification || p.textClassification || {};
  const bullets = {
    canalSalida: c.canalSalida || c.canal || '—',
    tipoSalida: c.tipoSalida || c.tipo || '—',
    riesgoGenerado: c.generaRiesgo ? (c.narrativaRiesgo || 'Riesgo registrado') : 'Acotado / bajo en esta lectura',
    oportunidadGenerada: c.generaOportunidad ? (c.narrativaOportunidad || 'Oportunidad latente') : 'Sin palanca explícita',
    accionInmediata: c.accionInmediata || 'Definir dueño y siguiente paso',
    guardadoLocal: committed ? 'Sí — memoria operativa y Centro de Ingesta' : 'Pendiente de confirmación',
    integrado: committed ? 'Sí — visible en HQ, flujo vivo y tablero sugerido' : 'No — solo vista previa',
  };

  return { version: JARVIS_VOICE_VERSION, voz: voz.slice(0, 4), bullets };
}

/**
 * @param {object} unified
 */
export function buildExecutiveResponse(unified) {
  const u = unified || {};
  const ad = u.jarvisAlienDecisionCore || {};
  const hq = u.jarvisFlowIntelligence?.hqNarrative || {};
  const cr = u.jarvisFrictionPressure?.capaRealidad || {};
  const bloqueado = Math.round(Number(cr.ingresoBloqueado) || 0);

  const lines = [];
  lines.push(ad.focoDelDia || hq.accionImpactoInmediato || 'Prioridad: un cierre con evidencia y un movimiento de pipeline hoy.');
  if (bloqueado > 0) lines.push(`Dinero retenido estimado: ~$${bloqueado.toLocaleString('es-CL')} hasta destrabar cierre o cobro.`);
  if (hq.personaFrenando) lines.push(`Cuello visible: ${hq.personaFrenando}`);
  return {
    version: JARVIS_VOICE_VERSION,
    parrafos: lines.slice(0, 4),
    tono: 'ejecutivo',
  };
}

/**
 * @param {object} event - fila de memoria inbound o meaning
 * @param {object} unified
 */
export function buildResponseToInboundEvent(event, unified) {
  const e = event || {};
  const u = unified || {};
  const ad = u.jarvisAlienDecisionCore || {};
  return {
    version: JARVIS_VOICE_VERSION,
    lead: `Registré ${e.canal || 'entrada'}${e.cliente && e.cliente !== '—' ? ` asociada a ${e.cliente}` : ''}.`,
    cierre: e.accionSugerida || ad.top3Acciones?.[0]?.accion || 'Definí dueño y próximo paso con hora.',
  };
}

export function buildDirectorBriefForHernan(unified) {
  const u = unified || {};
  const ad = u.jarvisAlienDecisionCore || {};
  const fr = u.jarvisFrictionPressure || {};
  const aa = fr.autoacciones || {};
  return {
    version: JARVIS_VOICE_VERSION,
    rol: 'Hernán',
    unaLinea:
      ad.estadoGlobal === 'critico'
        ? 'Hoy gobernás caja y riesgo: desbloqueá cobro antes de abrir nuevos frentes.'
        : 'Sostené ritmo: una victoria de cierre y una palanca comercial explícita en 48h.',
    prioridades: [aa.bloqueoCritico?.[0], aa.oportunidadInmediata?.[0], aa.hacerHoy?.[0]].filter(Boolean).slice(0, 3),
  };
}

export function buildDirectorBriefForLyn(unified) {
  const u = unified || {};
  const aa = u.jarvisFrictionPressure?.autoacciones || {};
  return {
    version: JARVIS_VOICE_VERSION,
    rol: 'Lyn',
    unaLinea: 'Tu frente es obra y evidencia: OT con fecha, hallazgo documentado, cierre técnico limpio.',
    prioridades: [aa.hacerHoy?.[0], u.jarvisFlowIntelligence?.hqNarrative?.accionImpactoInmediato].filter(Boolean).slice(0, 3),
  };
}

/**
 * Cronología para “Flujo de entrada en vivo” + toque de feeds.
 * @param {object} unified
 */
export function buildLiveInboundDigest(unified) {
  const u = unified || {};
  const mem = getInboundMeaningOnly(14);
  const opEvents = Array.isArray(u.jarvisOperativeEvents) ? u.jarvisOperativeEvents : [];
  const opItems = opEvents.slice(0, 20).map((e) => ({
    source: 'ingesta_operativa',
    at: e.at,
    canal: e.canalSalida || 'manual',
    titulo: e.tipoClasificado || 'Ingesta operativa',
    cliente: e.clienteDetectado || '—',
    responsable: e.responsableSugerido || '—',
    queEntro: String(e.rawExcerpt || e.accionInmediata || '—').slice(0, 140),
    significa: `Prioridad ${e.prioridad || 'NORMAL'} · ${e.tipoClasificado || '—'} · persistencia ${e.persistencia || '—'}`,
    queRiesgoGenera: e.generaRiesgo ? 'Riesgo marcado en ingesta manual.' : 'Riesgo acotado si corrés la acción sugerida.',
    queOportunidadAbre: e.generaOportunidad ? 'Oportunidad marcada en ingesta.' : 'Sin palanca explícita en el texto.',
    queAccionRecomienda: e.accionInmediata || 'Asignar dueño y siguiente paso con fecha.',
    urgencia: e.prioridad === 'CRITICO' ? 'alta' : e.prioridad === 'ALTO' ? 'media' : 'baja',
  }));
  /** @type {object[]} */
  const items = [
    ...opItems,
    ...mem.map((row) => ({
      source: 'memoria',
      at: row.at,
      canal: row.canal,
      titulo: row.titulo,
      cliente: row.cliente,
      responsable: row.responsable,
      queEntro: row.queEntro || row.resumen,
      significa: row.significa,
      queRiesgoGenera: row.queRiesgoGenera || row.riesgo,
      queOportunidadAbre: row.queOportunidadAbre || row.oportunidad,
      queAccionRecomienda: row.queAccionRecomienda || row.accionSugerida,
      urgencia: row.urgencia,
    })),
  ];

  const msgs = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages : [];
  const m0 = msgs[0];
  if (m0) {
    items.unshift({
      source: 'feed',
      at: m0.receivedAt || m0.date || u.outlookFeed?.lastIngestAt || new Date().toISOString(),
      canal: 'outlook',
      titulo: m0.subject || 'Correo',
      cliente: m0.from?.name || m0.from?.email || m0.sender || '—',
      responsable: m0.ownerHint || 'Bandeja',
      queEntro: `Llegó correo: ${(m0.subject || 'sin asunto').slice(0, 80)}.`,
      significa: 'Actualiza conversación con cliente o proveedor; puede llevar promesa o bloqueo oculto.',
      queRiesgoGenera: m0.severity === 'critical' || m0.priorityHint === 'crítica' ? 'Riesgo alto si no hay respuesta en horas.' : 'Riesgo de pérdida de ritmo si queda sin dueño.',
      queOportunidadAbre: 'Oportunidad de cerrar un hilo o convertir en OT / cobro.',
      queAccionRecomienda: 'Clasificar, responder o derivar a comercial/operaciones según contenido.',
      urgencia: m0.severity === 'critical' ? 'alta' : 'media',
    });
  }

  const wmsgs = Array.isArray(u.whatsappFeed?.messages) ? u.whatsappFeed.messages : [];
  const w0 = wmsgs[0];
  if (w0) {
    items.unshift({
      source: 'feed',
      at: w0.at || w0.ts || new Date().toISOString(),
      canal: 'whatsapp',
      titulo: 'Mensaje WhatsApp',
      cliente: w0.cliente || w0.chatName || '—',
      responsable: 'Operación',
      queEntro: `Mensaje en canal rápido: ${String(w0.text || w0.body || '').slice(0, 100)}`,
      significa: 'Acuerdos informales sin ERP generan conflicto y fuga de trazabilidad.',
      queRiesgoGenera: 'Riesgo de desalineación con lo facturado o prometido.',
      queOportunidadAbre: 'Registrar en OT o nota formal para cobrar y ejecutar.',
      queAccionRecomienda: 'Volcar a sistema o pegar export en ingesta unificada.',
      urgencia: 'media',
    });
  }

  items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    version: JARVIS_VOICE_VERSION,
    items: items.slice(0, 12),
  };
}
