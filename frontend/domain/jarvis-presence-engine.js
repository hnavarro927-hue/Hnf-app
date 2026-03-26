/**
 * Presencia y encendido — saludo, estado de ánimo del sistema, voz operativa.
 * Núcleo vivo Anunaki: saludo ejecutivo por contexto, sin tono asistente.
 */

import { getLastSignalsForGreeting } from './jarvis-memory.js';

export const JARVIS_PRESENCE_VERSION = '2026-03-24';

function slotFromHour(h) {
  if (h >= 5 && h < 12) return { label: 'mañana', greet: 'Buenos días' };
  if (h >= 12 && h < 20) return { label: 'tarde', greet: 'Buenas tardes' };
  return { label: 'noche', greet: 'Buenas noches' };
}

const MANTRAS = [
  'Observo. Interpreto. Conecto. Decido.',
  'El sistema no reacciona, se anticipa.',
  'Toda señal es dinero, riesgo u oportunidad.',
  'No archivo datos. Los convierto en decisiones.',
  'Protejo flujo, riesgo y continuidad.',
];

/** Una frase por sesión de pestaña (cada recarga de página puede cambiar). */
function pickMantraForLoad() {
  try {
    const k = 'hnf_jarvis_mantra_pick_v1';
    let v = sessionStorage.getItem(k);
    if (v == null) {
      v = String(Math.floor(Math.random() * MANTRAS.length));
      sessionStorage.setItem(k, v);
    }
    return MANTRAS[Number(v) % MANTRAS.length];
  } catch {
    return MANTRAS[0];
  }
}

/**
 * @param {string} [userName]
 * @param {Date} [now]
 */
export function buildJarvisGreeting(unified, userName = 'Hernan', now = new Date()) {
  const u = unified || {};
  const ad = u.jarvisAlienDecisionCore || {};
  const mp = u.jarvisFrictionPressure?.modoPresion || {};
  const h = now.getHours();
  const { greet } = slotFromHour(h);
  const name = String(userName || 'Hernan').trim() || 'Hernan';
  const signalHint = getLastSignalsForGreeting();

  let greeting = `${greet}, ${name}. Jarvis conectado.`;
  if (ad.estadoGlobal === 'critico' || mp.nivel === 'alta') {
    greeting = `${greet}, ${name}. Detecto presión alta en caja.`;
  } else if (ad.estadoGlobal === 'tension' || mp.nivel === 'media') {
    greeting = `${greet}, ${name}. Detecto presión operativa — foco acotado.`;
  } else if (signalHint) {
    greeting = `${greet}, ${name}. ${signalHint}`;
  }

  return { greeting, slot: slotFromHour(h).label, at: now.toISOString() };
}

/**
 * @param {object} unified
 */
export function buildJarvisStartupSequence(unified) {
  const u = unified || {};
  const ad = u.jarvisAlienDecisionCore || {};
  const cr = u.jarvisFrictionPressure?.capaRealidad || {};
  const bloqueado = Math.round(Number(cr.ingresoBloqueado) || 0);

  let startupLine = 'Sistema activo. Prioridad fijada. Recepción activa · sin salida automática.';
  if (ad.estadoGlobal === 'critico') {
    startupLine = `~$${bloqueado.toLocaleString('es-CL')} en bloqueo. Primero despejar cobro o cierre.`;
  } else if (!u.planOts?.length && !u.commercialOpportunities?.length) {
    startupLine = 'La operación sigue viva. Falta densidad de datos para dirección fina — cargá OT o pipeline.';
  }

  return {
    version: JARVIS_PRESENCE_VERSION,
    startupLine,
    fraseGuia: 'Todo evento alimenta el núcleo. No observo tareas aisladas: observo flujo, riesgo y consecuencia.',
  };
}

/**
 * @param {object} unified
 */
export function buildJarvisPresence(unified) {
  const u = unified || {};
  const ad = u.jarvisAlienDecisionCore || {};
  const mp = u.jarvisFrictionPressure?.modoPresion || {};
  const fi = u.jarvisFlowIntelligence || {};
  const hq = fi.hqNarrative || {};
  const now = new Date();
  const { greet } = slotFromHour(now.getHours());

  const systemMood = ad.estadoGlobal || (mp.nivel === 'alta' ? 'critico' : mp.nivel === 'media' ? 'tension' : 'estable');
  let voiceMode = 'ejecutivo';
  if (systemMood === 'critico' || mp.etiquetaPublica === 'accion_obligatoria') voiceMode = 'presion';
  else if (systemMood === 'tension' || mp.etiquetaPublica === 'alerta') voiceMode = 'alerta';

  const msgs = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages.length : 0;
  const wa = u.whatsappFeed?.messages;
  const waN = Array.isArray(wa) ? wa.length : u.whatsappFeed && typeof u.whatsappFeed === 'object' ? 1 : 0;
  const ots = Array.isArray(u.planOts) ? u.planOts.length : 0;
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities.length : 0;
  const urgCom = u.liveIngestion?.currentCommercial?.urgentesPendientes ?? 0;
  const critMail = msgs
    ? u.outlookFeed?.messages?.filter((m) => m.severity === 'critical' || m.priorityHint === 'crítica').length || 0
    : 0;

  const parts = [];
  if (msgs) parts.push(`${msgs} correo(s) en bandeja analizada`);
  if (critMail) parts.push(`${critMail} con señal fuerte`);
  if (ots) parts.push(`${ots} OT en vista`);
  if (opps) parts.push(`${opps} oportunidad(es) en pipeline`);
  if (waN) parts.push(`WhatsApp trazado (${waN})`);
  let summaryLine = parts.length ? parts.slice(0, 3).join(' · ') + '.' : 'Vigilancia activa. Listo para ingesta.';

  const { greeting } = buildJarvisGreeting(u, 'Hernan', now);
  const startup = buildJarvisStartupSequence(u);
  const cr = u.jarvisFrictionPressure?.capaRealidad || {};
  const bloqueado = Math.round(Number(cr.ingresoBloqueado) || 0);

  const brief = u.jarvisOperativeBrief || {};
  const lastOp = brief.last;
  const opCount = brief.count || 0;
  const freshMs = lastOp?.at ? Date.now() - new Date(lastOp.at).getTime() : Infinity;
  const fresh24h = Number.isFinite(freshMs) && freshMs < 86400000;

  const oportunidadActiva =
    (fresh24h && lastOp?.tipoClasificado === 'comercial') ||
    urgCom > 0 ||
    (fresh24h && lastOp?.prioridad === 'ALTO' && lastOp?.tipoClasificado === 'comercial');

  /** Saludo dominante — voz sistema, no asistente */
  let saludoDominante = `${greet}, Hernan. Jarvis activo. Monitoreo continuo de flujo, riesgo y oportunidad.`;

  if (ad.estadoGlobal === 'critico' || mp.nivel === 'alta' || mp.etiquetaPublica === 'accion_obligatoria') {
    saludoDominante = 'Hernan, el sistema entró en modo crítico. Acción obligatoria en curso.';
  } else if (ad.estadoGlobal === 'tension' || mp.nivel === 'media' || mp.etiquetaPublica === 'alerta') {
    saludoDominante =
      'Hernan, detecto presión operativa. Priorizo caja, continuidad y cierre inmediato.';
  } else if (oportunidadActiva) {
    saludoDominante = 'Hernan, nueva oportunidad detectada. Preparando decisión y movimiento recomendado.';
  } else if (bloqueado > 50000 && ad.estadoGlobal !== 'estable') {
    saludoDominante = `${greet}, Hernan. ~$${bloqueado.toLocaleString('es-CL')} bloqueado — priorizo desbloqueo.`;
  }

  const mantraOperativo = pickMantraForLoad();

  const commandSubtitle = saludoDominante;

  return {
    version: JARVIS_PRESENCE_VERSION,
    computedAt: new Date().toISOString(),
    greeting,
    saludoDominante,
    mantraOperativo,
    commandSubtitle,
    startupLine: startup.startupLine,
    fraseGuia: startup.fraseGuia,
    systemMood,
    voiceMode,
    summaryLine,
    cuelloResumido: hq.personaFrenando || null,
    dineroResumido: hq.dondeSePierdeDinero || null,
  };
}
