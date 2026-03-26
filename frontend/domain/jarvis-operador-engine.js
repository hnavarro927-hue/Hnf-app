/**
 * Jarvis Operador — análisis empresarial continuo (solo lectura / propuestas).
 * No ejecuta acciones externas.
 */

import { buildJarvisCommercialIntelAdvanced } from './jarvis-commercial-intel-advanced.js';
import { detectJarvisBusinessErrors } from './jarvis-business-errors.js';
import { runJarvisRealityEngine } from './jarvis-reality-engine.js';
import { runOpportunityDiscoveryEngine } from './jarvis-opportunity-discovery.js';
import { runHiddenErrorsEngine } from './jarvis-hidden-errors-engine.js';
import { runUrgencyEngine } from './jarvis-urgency-engine.js';

export const JARVIS_OPERADOR_VERSION = '2026-03-24';

export const JARVIS_OPERADOR_MANTRA = 'No gestiono tareas, gestiono dinero, riesgo y oportunidad.';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const norm = (s) => String(s || '').trim().toLowerCase();

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const hoursSince = (iso) => {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
};

function buildDocumentReview(unified) {
  const u = unified || {};
  const docs = Array.isArray(u.technicalDocuments) ? u.technicalDocuments : [];
  const alerts = Array.isArray(u.technicalDocumentAlerts) ? u.technicalDocumentAlerts : [];
  const dly = u.outlookFollowUp?.delayAlerts || [];
  const planOts = Array.isArray(u.planOts) ? u.planOts : [];

  /** @type {{ codigo: string, detalle: string, severidad?: string }[]} */
  const erroresDetectados = [];

  for (const a of alerts.slice(0, 25)) {
    erroresDetectados.push({
      codigo: a.code || 'DOC_ALERT',
      detalle: a.mensaje || String(a),
      severidad: a.severity || 'info',
    });
  }

  const observados = docs.filter((d) => d.estadoDocumento === 'observado');
  const enRev = docs.filter((d) => d.estadoDocumento === 'en_revision');
  const aprobSinEnv = docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn);
  if (observados.length) {
    erroresDetectados.push({
      codigo: 'DOC_OBSERVADO',
      detalle: `${observados.length} documento(s) en observado — riesgo de retrabajo y demora.`,
      severidad: 'warning',
    });
  }
  if (enRev.length) {
    erroresDetectados.push({
      codigo: 'DOC_EN_REVISION',
      detalle: `${enRev.length} documento(s) en revisión Lyn/pipeline.`,
      severidad: 'info',
    });
  }
  if (aprobSinEnv.length) {
    erroresDetectados.push({
      codigo: 'DOC_APROBADO_SIN_ENVIO',
      detalle: `${aprobSinEnv.length} aprobado(s) sin marca de envío al cliente.`,
      severidad: 'warning',
    });
  }

  for (const a of dly.slice(0, 12)) {
    erroresDetectados.push({
      codigo: a.code || 'OUT_SEGUIMIENTO',
      detalle: a.title || a.detail || 'Seguimiento correo pendiente',
      severidad: a.severity || 'info',
    });
  }

  const otSinEconomia = planOts.filter(
    (o) => norm(o.estado) === 'terminado' && roundMoney(o.montoCobrado) <= 0
  );
  if (otSinEconomia.length) {
    erroresDetectados.push({
      codigo: 'OT_TERMINADA_SIN_FACTURACION',
      detalle: `${otSinEconomia.length} OT terminada(s) sin monto cobrado registrado.`,
      severidad: 'critical',
    });
  }

  let nivelRiesgo = 'bajo';
  const crit = erroresDetectados.filter((e) => e.severidad === 'critical').length;
  const warn = erroresDetectados.filter((e) => e.severidad === 'warning').length;
  if (crit >= 1 || warn >= 4) nivelRiesgo = 'alto';
  else if (warn >= 1 || erroresDetectados.length >= 6) nivelRiesgo = 'medio';

  let impactoEconomico = 'Impacto documental/comercial acotado en este corte.';
  if (crit >= 1) impactoEconomico = 'Alto riesgo de fuga o retrabajo: cierres sin cobro o bloqueos de entrega.';
  else if (nivelRiesgo === 'medio') impactoEconomico = 'Riesgo medio: demoras en revisión o seguimiento pueden retrasar facturación.';

  let accionRecomendada = 'Mantener revisión semanal de documentos y correos abiertos.';
  if (aprobSinEnv.length) accionRecomendada = 'Priorizar envío al cliente y registro en ERP para documentos aprobados.';
  else if (observados.length) accionRecomendada = 'Corregir observados y reenviar a revisión en el mismo día hábil.';
  else if (otSinEconomia.length) accionRecomendada = 'Completar economía y facturación de OT ya terminadas.';

  return {
    erroresDetectados: erroresDetectados.slice(0, 40),
    nivelRiesgo,
    impactoEconomico,
    accionRecomendada,
  };
}

function buildMoneyLeaks(unified) {
  const fi = unified.jarvisFlowIntelligence;
  const econ = fi?.economicState || {};
  const flow = fi?.flowState || {};
  const ingresoBloqueado = roundMoney(econ.ingresoBloqueado);
  const fugaDinero = roundMoney(econ.fugaDinero);
  let urgencia = 'media';
  if (flow.inactividadCritica || ingresoBloqueado >= 600_000) urgencia = 'critica';
  else if (ingresoBloqueado >= 250_000 || fugaDinero >= 80_000 || (econ.oportunidadNoTomada || 0) > 0)
    urgencia = 'alta';
  else if (ingresoBloqueado < 80_000 && fugaDinero < 20_000 && (econ.oportunidadNoTomada || 0) === 0)
    urgencia = 'baja';

  return {
    ingresoBloqueado,
    fugaDinero,
    oportunidadPerdida: econ.oportunidadNoTomada ?? 0,
    urgencia,
  };
}

function applyRealityToMoneyLeaks(moneyLeaks, reality) {
  const r = reality || {};
  if (r.jarvisModo !== 'inferencial') return { ...moneyLeaks };
  return {
    ...moneyLeaks,
    ingresoBloqueado: Math.max(
      roundMoney(moneyLeaks.ingresoBloqueado),
      roundMoney(r.minIngresoBloqueado)
    ),
    fugaDinero: Math.max(roundMoney(moneyLeaks.fugaDinero), roundMoney(r.minFugaDinero)),
  };
}

function refineMoneyLeaksUrgency(moneyLeaks, unified) {
  const fi = unified.jarvisFlowIntelligence;
  const econ = fi?.economicState || {};
  const flow = fi?.flowState || {};
  const ingresoBloqueado = moneyLeaks.ingresoBloqueado;
  const fugaDinero = moneyLeaks.fugaDinero;
  let urgencia = 'media';
  if (flow.inactividadCritica || ingresoBloqueado >= 600_000) urgencia = 'critica';
  else if (ingresoBloqueado >= 250_000 || fugaDinero >= 80_000 || (moneyLeaks.oportunidadPerdida || econ.oportunidadNoTomada || 0) > 0)
    urgencia = 'alta';
  else if (ingresoBloqueado < 80_000 && fugaDinero < 20_000 && (econ.oportunidadNoTomada || 0) === 0)
    urgencia = 'baja';
  return { ...moneyLeaks, urgencia };
}

const _urgOrder = { baja: 0, media: 1, alta: 2, critica: 3 };

function maxUrgency(a, b) {
  const ka = _urgOrder[a] != null ? a : 'media';
  const kb = _urgOrder[b] != null ? b : 'media';
  return _urgOrder[kb] > _urgOrder[ka] ? kb : ka;
}

function buildOpportunityEngine(unified) {
  const comm = unified.jarvisCommercialIntelAdvanced || buildJarvisCommercialIntelAdvanced(unified);
  const hot = comm.oportunidadesCalientes || [];
  const zonas = comm.zonasSubexplotadas || [];
  const dormidos = comm.clientesDormidos || [];
  const planOts = Array.isArray(unified.planOts) ? unified.planOts : [];
  const opps = Array.isArray(unified.commercialOpportunities) ? unified.commercialOpportunities : [];

  const byClienteOt = new Map();
  for (const o of planOts) {
    const c = String(o.cliente || '').trim();
    if (!c) continue;
    byClienteOt.set(c, (byClienteOt.get(c) || 0) + 1);
  }
  const byClienteOpp = new Map();
  for (const o of opps) {
    const c = String(o.cliente || '').trim();
    if (!c) continue;
    byClienteOpp.set(c, (byClienteOpp.get(c) || 0) + 1);
  }

  const upsellCandidates = [];
  for (const [cliente, nOt] of byClienteOt) {
    const nOpp = byClienteOpp.get(cliente) || 0;
    if (nOt >= 2 && nOpp === 0) {
      upsellCandidates.push({
        tipo: 'cliente_activo_sin_pipeline',
        cliente,
        detalle: `${nOt} OT registradas sin oportunidad comercial vinculada — revisar upsell / contrato.`,
      });
    }
  }

  const serviciosOfrecidos = new Set(
    planOts.map((o) => norm(o.subtipoServicio || o.tipoServicio || '')).filter(Boolean)
  );
  const serviciosNoOfrecidos =
    serviciosOfrecidos.size < 2
      ? ['Diversificar subtipos de servicio en datos cargados (pocas categorías detectadas).']
      : [];

  const top = hot[0];
  const topZona = zonas[0];
  let oportunidadDetectada = top
    ? `${top.cliente}: oportunidad caliente (~$${Math.round(top.estimacionMonto).toLocaleString('es-CL')}).`
    : topZona
      ? `Zona ${topZona.comuna}: actividad ${topZona.totalOt} OT con solo ${topZona.ratioCierre}% cierre — potencial de mejora.`
      : upsellCandidates[0]
        ? `Cliente activo sin upsell: ${upsellCandidates[0].cliente}.`
        : dormidos[0]
          ? `Cliente dormido en pipeline: ${dormidos[0].cliente} (${Math.round(dormidos[0].maxHoras)}h).`
          : 'Sin oportunidad destacada en este corte — alimentar pipeline comercial.';

  const valorEstimado = top
    ? roundMoney(top.estimacionMonto)
    : topZona
      ? Math.round(topZona.totalOt * 180_000)
      : upsellCandidates.length * 200_000;

  const probabilidadCierre = top?.probabilidadCierre ?? comm.probabilidadCierre?.promedioPipeline ?? 35;

  let accion = 'Revisar oportunidades y actualizar estado en ERP.';
  if (top) accion = `Gestionar ya ${top.cliente}: llamada + siguiente paso explícito en pipeline.`;
  else if (topZona) accion = `Planificar ronda comercial/técnica en ${topZona.comuna} para subir tasa de cierre.`;
  else if (upsellCandidates[0]) accion = `Abrir conversación comercial con ${upsellCandidates[0].cliente} (cliente con OT recurrentes).`;

  return {
    oportunidadDetectada,
    valorEstimado,
    probabilidadCierre,
    accion,
    _detalle: {
      calientes: hot.slice(0, 5),
      zonas: zonas.slice(0, 5),
      clientesActivosSinUpsell: upsellCandidates.slice(0, 6),
      patronesRepetitivos: (comm.meta?.patronesPerdida || []).slice(0, 4),
      serviciosNoOfrecidosHint: serviciosNoOfrecidos,
    },
  };
}

function buildTeamAnalysis(unified) {
  const fi = unified.jarvisFlowIntelligence;
  const hs = fi?.humanSignals || {};
  const riesgo = hs.riesgoOperacionalPorPersona || {};
  const carga = hs._meta?.cargaOtAbiertaPorPersona || {};
  const outlook = hs._meta?.outlookPendientes || {};

  const cargaTrabajo = {
    otAbiertaPorPersona: { ...carga },
    outlookPendientes: { ...outlook },
  };

  let recomendacion = 'Distribución equilibrada — mantener ritmo de seguimiento.';
  if (hs.dependenciaCritica) {
    recomendacion = `Dependencia fuerte en ${hs.dependenciaCritica}: redistribuir o bloquear tiempo de desbloqueo esta semana.`;
  } else if ((riesgo.sin_asignar || 0) >= 55) {
    recomendacion = 'Muchas OT sin técnico asignado — asignar responsables para evitar tiempo muerto.';
  } else if ((riesgo.Romina || 0) >= 70 || (riesgo.Gery || 0) >= 70) {
    recomendacion = 'Correo/tareas comerciales concentradas — priorizar cola de Romina/Gery.';
  }

  const quienRetrasa =
    (riesgo.Romina || 0) >= (riesgo.Gery || 0) && (riesgo.Romina || 0) >= (riesgo.Lyn || 0)
      ? 'Señal más fuerte en cola Romina/correo.'
      : (riesgo.Gery || 0) >= (riesgo.Lyn || 0)
        ? 'Señal más fuerte en cola Gery/comercial.'
        : 'Revisar carga Lyn vs técnicos de campo.';

  const quienNoResponde =
    (outlook.Romina || 0) > 4 || (outlook.Gery || 0) > 4
      ? 'Correos abiertos por dueño sugieren cuellos de respuesta interna.'
      : 'Sin cola de correo crítica por volumen.';

  return {
    riesgoPorPersona: { ...riesgo },
    cargaTrabajo,
    dependencia: hs.dependenciaCritica || null,
    recomendacion,
    _meta: { quienRetrasa, quienNoResponde, criticoEquipo: hs.necesidadIntervencion || false },
  };
}

function buildCentralDecision(unified, documentReview, moneyLeaks, opportunityEngine, teamAnalysis) {
  const dl = unified.jarvisFlowIntelligence?.jarvisDecisionLayer;
  const fi = unified.jarvisFlowIntelligence;

  let focoPrincipal = dl?.focoPrincipal || 'Mantener operación y pipeline visibles';
  let accionInmediata = dl?.accionRecomendada || documentReview.accionRecomendada;
  let impacto = dl?.impactoEsperado || documentReview.impactoEconomico;
  let prioridadReal = dl?.urgenciaReal || moneyLeaks.urgencia;

  if (moneyLeaks.urgencia === 'critica') {
    focoPrincipal = 'Dinero retenido o fuga alta — desbloquear cierres y cobros';
    accionInmediata = fi?.hqNarrative?.accionImpactoInmediato || accionInmediata;
  }
  if (documentReview.nivelRiesgo === 'alto' && moneyLeaks.urgencia !== 'critica') {
    focoPrincipal = 'Riesgo documental/comercial — corregir antes de escalar volumen';
  }

  return {
    focoPrincipal,
    accionInmediata,
    impacto,
    prioridadReal,
    dondeEstaElDinero: `Bloqueado ~$${Math.round(moneyLeaks.ingresoBloqueado).toLocaleString('es-CL')} · fuga demora ~$${Math.round(moneyLeaks.fugaDinero).toLocaleString('es-CL')}.`,
    queLoFrena: fi?.hqNarrative?.personaFrenando || teamAnalysis._meta?.quienRetrasa || '—',
    queHacerAhora: accionInmediata,
  };
}

function mergeDiscoveryIntoOpportunity(opportunityEngine, discoveryPack) {
  const first = discoveryPack?.oportunidades?.[0];
  if (!first) return opportunityEngine;
  const txt = String(opportunityEngine.oportunidadDetectada || '');
  const weak =
    txt.includes('Sin oportunidad') ||
    txt.includes('alimentar pipeline') ||
    txt.includes('no destacada') ||
    roundMoney(opportunityEngine.valorEstimado || 0) < roundMoney(first.valorEstimado) * 0.55;
  if (!weak) return opportunityEngine;
  return {
    ...opportunityEngine,
    oportunidadDetectada: first.titulo,
    valorEstimado: Math.max(
      roundMoney(opportunityEngine.valorEstimado || 0),
      roundMoney(first.valorEstimado)
    ),
    probabilidadCierre: first.probabilidad ?? opportunityEngine.probabilidadCierre,
    accion: first.accionSugerida || opportunityEngine.accion,
  };
}

function buildJarvisDecidePack(
  unified,
  decision,
  moneyLeaks,
  opportunityEngine,
  teamAnalysis,
  hiddenErrors,
  reality,
  discoveryPack
) {
  const topHidden = hiddenErrors?.items?.[0];
  const topDisc = discoveryPack?.oportunidades?.[0];
  const opEmpty = !(Array.isArray(unified.commercialOpportunities)
    ? unified.commercialOpportunities
    : []
  ).length;

  const queFrena =
    decision.queLoFrena ||
    decision.focoPrincipal ||
    topHidden?.titulo ||
    (reality?.jarvisModo === 'inferencial'
      ? 'Sistema operando a ciegas: datos mínimos — el freno es medición, no capacidad.'
      : 'Fricción en cierre/cobro sin dueño explícito en datos.');

  const accionMasDinero =
    topDisc?.accionSugerida ||
    opportunityEngine.accion ||
    decision.accionInmediata ||
    'Hoy: cerrar 1 OT con monto cobrado registrado + 1 llamada comercial con siguiente paso escrito.';

  const ignorar = opEmpty
    ? 'Perfeccionar dashboards sin cargar OT, clientes u oportunidades reales.'
    : 'Debates internos sin cliente, monto ni fecha de cierre en las próximas 48 h.';

  const riesgoOculto =
    topHidden?.detalle ||
    (opEmpty
      ? 'Pipeline no visible: el mes siguiente puede caer sin alerta temprana.'
      : teamAnalysis.dependencia
        ? `Dependencia silenciosa en ${teamAnalysis.dependencia} — riesgo de cuello único.`
        : 'Problemas conocidos que no entran a cola de cobro — fuga por omisión.');

  return { queFrena, accionMasDinero, ignorar, riesgoOculto };
}

/**
 * @param {object} unified - estado completo post getJarvisUnifiedState (con flow + opcional enterprise)
 */
export function buildJarvisOperador(unified) {
  const src = unified || {};
  const u = { ...src };
  if (!u.jarvisCommercialIntelAdvanced) {
    u.jarvisCommercialIntelAdvanced = buildJarvisCommercialIntelAdvanced(u);
  }
  if (!u.jarvisBusinessErrors) {
    u.jarvisBusinessErrors = detectJarvisBusinessErrors(u);
  }

  const reality = runJarvisRealityEngine(u);
  const documentReview = buildDocumentReview(u);
  let moneyLeaks = buildMoneyLeaks(u);
  moneyLeaks = applyRealityToMoneyLeaks(moneyLeaks, reality);
  moneyLeaks = refineMoneyLeaksUrgency(moneyLeaks, u);
  let opportunityEngine = buildOpportunityEngine(u);
  const opportunityDiscovery = runOpportunityDiscoveryEngine(u, reality);
  opportunityEngine = mergeDiscoveryIntoOpportunity(opportunityEngine, opportunityDiscovery);
  const teamAnalysis = buildTeamAnalysis(u);
  const hiddenErrors = runHiddenErrorsEngine(u);
  let decision = buildCentralDecision(u, documentReview, moneyLeaks, opportunityEngine, teamAnalysis);
  const urgencyEngine = runUrgencyEngine(u, {
    moneyLeaks,
    flowIntel: u.jarvisFlowIntelligence,
    opportunityDiscoveryCount: opportunityDiscovery.oportunidades?.length || 0,
    reality,
    hiddenErrors,
  });
  moneyLeaks = { ...moneyLeaks, urgencia: maxUrgency(moneyLeaks.urgencia, urgencyEngine.nivel) };
  decision = { ...decision, prioridadReal: moneyLeaks.urgencia };
  const jarvisDecide = buildJarvisDecidePack(
    u,
    decision,
    moneyLeaks,
    opportunityEngine,
    teamAnalysis,
    hiddenErrors,
    reality,
    opportunityDiscovery
  );
  decision = {
    ...decision,
    focoPrincipal: jarvisDecide.queFrena,
    accionInmediata: jarvisDecide.accionMasDinero,
  };

  return {
    version: JARVIS_OPERADOR_VERSION,
    computedAt: new Date().toISOString(),
    mantra: JARVIS_OPERADOR_MANTRA,
    jarvisModo: reality.jarvisModo,
    inferenciaMensaje: reality.mensajeInferencia,
    reality,
    documentReview,
    moneyLeaks,
    opportunityEngine,
    opportunityDiscovery,
    teamAnalysis,
    hiddenErrors,
    urgencyEngine,
    decision,
    jarvisDecide,
  };
}

/**
 * Para Pulse: base + flowPack + MAPE opcional (sin pasar por getJarvisUnifiedState completo).
 */
export function buildJarvisOperadorPulsePack(base, mapeEnvelope, flowPack) {
  const b = base || {};
  const u = {
    ...b,
    jarvisFlowIntelligence: flowPack,
    autonomicState: mapeEnvelope && !mapeEnvelope.skipped ? mapeEnvelope : null,
    systemHealth: mapeEnvelope?.systemHealth,
    riskLevel: mapeEnvelope?.riskLevel,
  };
  u.jarvisCommercialIntelAdvanced = buildJarvisCommercialIntelAdvanced(u);
  u.jarvisBusinessErrors = detectJarvisBusinessErrors(u);
  return buildJarvisOperador(u);
}

/**
 * Vista unificada para HQ (operator.*): prioridad operador + refuerzo flow.
 * @param {object} [opts] - { jarvisExecutionLevel?: string }
 */
export function buildJarvisOperatorViewModel(operadorPack, flowIntel, opts = {}) {
  const op = operadorPack || {};
  const fi = flowIntel || {};
  const exec = opts.jarvisExecutionLevel || opts.jarvisMode || 'assist';
  const jarvisModoOperador =
    exec === 'observe' ? 'observación' : exec === 'assist' ? 'asistido' : 'operador';
  const ml = op.moneyLeaks || {};
  const econ = fi.economicState || {};
  const dr = op.documentReview || {};
  const oe = op.opportunityEngine || {};
  const ta = op.teamAnalysis || {};
  const dl = fi.jarvisDecisionLayer || {};
  const dec = op.decision || {};
  const jd = op.jarvisDecide || {};
  const hidden = op.hiddenErrors || { items: [] };
  const disc = op.opportunityDiscovery;

  let textoCorto =
    ml.urgencia === 'critica' || ml.urgencia === 'alta'
      ? 'Presión monetaria inmediata: cerrar y cobrar.'
      : 'Monitorear cierre de OT y pipeline comercial.';
  if (op.jarvisModo === 'inferencial') {
    textoCorto = `Inferencia activa · ${textoCorto}`;
  }

  const money = {
    ingresoBloqueado: roundMoney(ml.ingresoBloqueado ?? econ.ingresoBloqueado ?? 0),
    fugaDinero: roundMoney(ml.fugaDinero ?? econ.fugaDinero ?? 0),
    oportunidadPerdida: ml.oportunidadPerdida ?? econ.oportunidadNoTomada ?? 0,
    urgencia: ml.urgencia || 'media',
    textoCorto,
  };

  const risk = {
    valorCritico: dr.nivelRiesgo || 'bajo',
    texto:
      dr.accionRecomendada ||
      dr.impactoEconomico ||
      fi.hqNarrative?.personaFrenando ||
      'Sin fricción documental crítica en este corte.',
    erroresCount: (dr.erroresDetectados || []).length,
  };

  const opportunity = {
    valorCritico: oe.oportunidadDetectada || '—',
    texto: oe.accion || 'Alimentar oportunidades en el sistema.',
    valorEstimado: roundMoney(oe.valorEstimado || 0),
    probabilidadCierre: oe.probabilidadCierre ?? null,
  };

  const rp = ta.riesgoPorPersona || {};
  const rvals = Object.values(rp).map((n) => Number(n) || 0);
  const rmax = rvals.length ? Math.max(...rvals) : 0;

  const team = {
    valorCritico:
      ta.dependencia || (rmax >= 65 ? 'Desbalance operativo' : 'Sin dependencia crítica'),
    texto: ta.recomendacion || 'Mantener comunicación y asignaciones claras.',
    cargaResumen: `Gery ${rp.Gery ?? 0} · Romina ${rp.Romina ?? 0} · Lyn ${rp.Lyn ?? 0}`,
    riesgoMax: rmax,
  };

  const decision = {
    focoPrincipal: dec.focoPrincipal || jd.queFrena || dl.focoPrincipal || '—',
    accionInmediata: dec.accionInmediata || jd.accionMasDinero || dl.accionRecomendada || '—',
    impacto: dec.impacto || dl.impactoEsperado || '—',
    prioridadReal: dec.prioridadReal || dl.urgenciaReal || ml.urgencia || 'media',
    dondeEstaElDinero: dec.dondeEstaElDinero,
    queLoFrena: dec.queLoFrena || jd.queFrena,
  };

  return {
    version: JARVIS_OPERADOR_VERSION,
    mantra: JARVIS_OPERADOR_MANTRA,
    jarvisDataMode: op.jarvisModo || 'datos',
    inferenciaMensaje: op.inferenciaMensaje || null,
    jarvisModoOperador,
    urgencyEngine: op.urgencyEngine || null,
    jarvisDecide: {
      queFrena:
        jd.queFrena ||
        decision.focoPrincipal ||
        'Cargar estado operativo: sin paquete operador aún no hay freno explícito.',
      accionMasDinero:
        jd.accionMasDinero ||
        decision.accionInmediata ||
        'Registrar 1 OT y 1 oportunidad para que Jarvis priorice con datos.',
      ignorar: jd.ignorar || 'Ruido sin impacto en cobro hoy.',
      riesgoOculto: jd.riesgoOculto || hidden.headline || risk.texto || 'Ceguera por datos incompletos.',
    },
    hoyEnHnf: {
      accionCritica:
        jd.accionMasDinero || decision.accionInmediata || 'Esperando paquete operador / pulse.',
      dineroEnJuego:
        decision.dondeEstaElDinero ||
        `Bloqueado ~$${Math.round(money.ingresoBloqueado).toLocaleString('es-CL')} · fuga ~$${Math.round(money.fugaDinero).toLocaleString('es-CL')}`,
      oportunidadDelDia: oe.oportunidadDetectada || disc?.oportunidades?.[0]?.titulo || 'Oportunidad latente: cargar pipeline.',
      riesgoOculto: jd.riesgoOculto || hidden.headline || 'Riesgo no modelado hasta completar ingesta.',
    },
    erroresNegocio: Array.isArray(hidden.items) ? hidden.items.slice(0, 8) : [],
    opportunityDiscovery: disc || null,
    money,
    risk,
    opportunity,
    team,
    decision,
  };
}

export function computeOperadorFingerprint(pack) {
  if (!pack) return '';
  const m = pack.moneyLeaks || {};
  const d = pack.documentReview || {};
  return JSON.stringify({
    ib: Math.round(m.ingresoBloqueado || 0),
    fd: Math.round(m.fugaDinero || 0),
    nr: d.nivelRiesgo,
    ne: (d.erroresDetectados || []).length,
    od: String((pack.opportunityEngine || {}).oportunidadDetectada || '').slice(0, 80),
  });
}
