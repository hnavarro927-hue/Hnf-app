/**
 * Jarvis Flow Intelligence — flujo operativo, impacto económico y prioridad dinero > tareas.
 * Solo lectura / heurísticas locales; no ejecuta acciones externas.
 */

export const JARVIS_FLOW_INTEL_VERSION = '2026-03-23';

const MANTRA = 'No optimizo tareas, optimizo dinero y flujo.';

const UMBRAL_INGRESO_BLOQUEADO_CLP = 450_000;
const DIAS_INACTIVIDAD_CRITICA = 12;
const DIAS_RITMO_LENTO = 6;
const CAPACIDAD_REF_OT = 24;

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const normEstado = (o) => norm(o?.estado).replace(/\s+/g, ' ');

const isOtClosed = (o) => normEstado(o) === 'terminado';

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const daysSince = (isoOrYmd) => {
  const t = parseTs(isoOrYmd);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / 86400000);
};

const hoursSince = (iso) => {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
};

/** @param {string} tecnicoAsignado */
export function mapTecnicoToPersonaClave(tecnicoAsignado) {
  const s = norm(tecnicoAsignado);
  if (!s) return 'sin_asignar';
  if (s.includes('gery')) return 'Gery';
  if (s.includes('romina')) return 'Romina';
  if (s.includes('lyn')) return 'Lyn';
  return 'otros';
}

/**
 * @param {object} ctx
 * @param {object[]} ctx.planOts
 * @param {object} [ctx.outlookFollowUp]
 * @param {object[]} [ctx.commercialOpportunities]
 * @param {object} [ctx.commercialSummary]
 * @param {object[]} [ctx.operationalCalendarAlerts]
 * @param {object} [ctx.autonomicEnvelope] - resultado MAPE (opcional)
 */
export function computeJarvisFlowPack(ctx = {}) {
  const planOts = Array.isArray(ctx.planOts) ? ctx.planOts : [];
  const otsClima = planOts.filter(isOtClima);
  const openOts = otsClima.filter((o) => !isOtClosed(o));
  const closedOts = otsClima.filter((o) => isOtClosed(o));

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const closedLast7d = closedOts.filter((o) => {
    const t = parseTs(o.cerradoEn || o.updatedAt);
    return Number.isFinite(t) && t >= weekAgo;
  }).length;

  const avgIdleOpen =
    openOts.length === 0
      ? 0
      : openOts.reduce((s, o) => {
          const dF = daysSince(o.fecha);
          const dU = daysSince(o.updatedAt);
          const d = [dF, dU].filter((x) => x != null);
          return s + (d.length ? Math.max(...d) : 0);
        }, 0) / openOts.length;

  const stalledOpen = openOts.filter((o) => {
    const dF = daysSince(o.fecha);
    const dU = daysSince(o.updatedAt);
    const d = [dF, dU].filter((x) => x != null);
    return d.length && Math.max(...d) >= DIAS_RITMO_LENTO;
  });

  const hiddenBacklog = openOts.filter((o) => {
    const dU = daysSince(o.updatedAt);
    return dU != null && dU >= 5 && normEstado(o) === 'pendiente';
  });

  const byPerson = { Gery: 0, Romina: 0, Lyn: 0, otros: 0, sin_asignar: 0 };
  for (const o of openOts) {
    const k = mapTecnicoToPersonaClave(o.tecnicoAsignado);
    byPerson[k] = (byPerson[k] || 0) + 1;
  }

  const totalOpen = openOts.length || 1;
  const share = (n) => Math.round((n / totalOpen) * 1000) / 10;
  const maxPerson = Object.entries(byPerson).sort((a, b) => b[1] - a[1])[0];
  const saturation = Math.min(100, Math.round((totalOpen / CAPACIDAD_REF_OT) * 100));

  let ritmo = 'medio';
  if (closedLast7d >= Math.max(3, openOts.length * 0.35) && avgIdleOpen < 4) ritmo = 'alto';
  else if (closedLast7d <= 1 || avgIdleOpen >= DIAS_RITMO_LENTO) ritmo = 'bajo';

  let cuelloBotella = 'proceso';
  if (maxPerson && maxPerson[1] / totalOpen >= 0.38 && maxPerson[0] !== 'otros') cuelloBotella = 'persona';
  else if (hiddenBacklog.length >= 3) cuelloBotella = 'proceso';
  else if (stalledOpen.length >= 4) cuelloBotella = 'cliente';

  const inactividadCritica =
    avgIdleOpen >= DIAS_INACTIVIDAD_CRITICA ||
    stalledOpen.some((o) => {
      const dF = daysSince(o.fecha);
      const dU = daysSince(o.updatedAt);
      const d = [dF, dU].filter((x) => x != null);
      return d.length && Math.max(...d) >= DIAS_INACTIVIDAD_CRITICA;
    });

  const flowState = {
    ritmo,
    cuelloBotella,
    saturacion: saturation,
    inactividadCritica,
    _meta: {
      openCount: openOts.length,
      closedLast7d,
      avgIdleOpenDays: Math.round(avgIdleOpen * 10) / 10,
      hiddenBacklogCount: hiddenBacklog.length,
      stalledCount: stalledOpen.length,
    },
  };

  const closedRecentMoney = closedOts.filter((o) => {
    const t = parseTs(o.cerradoEn || o.updatedAt);
    return Number.isFinite(t) && t >= now - 30 * 86400000;
  });
  const avgMontoClosed =
    closedRecentMoney.length === 0
      ? 0
      : closedRecentMoney.reduce((s, o) => s + roundMoney(o.montoCobrado), 0) / closedRecentMoney.length;

  let ingresoBloqueado = 0;
  for (const o of openOts) {
    const m = roundMoney(o.montoCobrado);
    if (m > 0) ingresoBloqueado += m;
    else if (avgMontoClosed > 0) ingresoBloqueado += avgMontoClosed * 0.65;
  }
  ingresoBloqueado = Math.round(ingresoBloqueado * 100) / 100;

  const todayYmd = new Date();
  const ymd = `${todayYmd.getFullYear()}-${String(todayYmd.getMonth() + 1).padStart(2, '0')}-${String(todayYmd.getDate()).padStart(2, '0')}`;
  const cerradosHoy = closedOts.filter((o) => String(o.cerradoEn || '').slice(0, 10) === ymd);
  const ingresoCerradosHoy = cerradosHoy.reduce((s, o) => s + roundMoney(o.montoCobrado), 0);
  const potMes = Number(ctx.commercialSummary?.potencialTotalMes || 0);
  const ingresoProyectadoHoy =
    Math.round((ingresoCerradosHoy + potMes / 22 + avgMontoClosed * 0.15) * 100) / 100;

  let fugaDinero = 0;
  for (const o of stalledOpen) {
    const dF = daysSince(o.fecha);
    const dU = daysSince(o.updatedAt);
    const d = [dF, dU].filter((x) => x != null);
    const stall = d.length ? Math.max(...d) : 0;
    if (stall < DIAS_RITMO_LENTO) continue;
    const base = roundMoney(o.montoCobrado) > 0 ? roundMoney(o.montoCobrado) : avgMontoClosed * 0.65;
    fugaDinero += Math.min(stall, 30) * base * 0.012;
  }
  fugaDinero = Math.round(fugaDinero * 100) / 100;

  const opps = Array.isArray(ctx.commercialOpportunities) ? ctx.commercialOpportunities : [];
  let oportunidadNoTomada = 0;
  for (const o of opps) {
    if (!['pendiente', 'cotizado'].includes(String(o.estado))) continue;
    if (String(o.prioridad) === 'alta') {
      const h = hoursSince(o.fechaCreacion || o.creadoEn || o.createdAt || o.actualizadoEn);
      if (h != null && h > 72) oportunidadNoTomada += 1;
    }
  }

  const economicState = {
    ingresoProyectadoHoy,
    ingresoBloqueado,
    fugaDinero,
    oportunidadNoTomada,
    _meta: {
      avgTicketCerrado: Math.round(avgMontoClosed * 100) / 100,
      otAbiertasClima: openOts.length,
    },
  };

  const pending = ctx.outlookFollowUp?.pendingByOwner || {};
  const rominaP = (pending.Romina || []).length;
  const geryP = (pending.Gery || []).length;
  const lynP = (pending.Lyn || []).length;

  const riesgoOperacionalPorPersona = {
    Gery: Math.min(100, Math.round(geryP * 12 + byPerson.Gery * 14 + (cuelloBotella === 'persona' && maxPerson[0] === 'Gery' ? 25 : 0))),
    Romina: Math.min(100, Math.round(rominaP * 10 + byPerson.Romina * 14 + (cuelloBotella === 'persona' && maxPerson[0] === 'Romina' ? 25 : 0))),
    Lyn: Math.min(100, Math.round(lynP * 8 + byPerson.Lyn * 14 + (cuelloBotella === 'persona' && maxPerson[0] === 'Lyn' ? 25 : 0))),
    otros: Math.min(100, Math.round(byPerson.otros * 12)),
    sin_asignar: Math.min(100, Math.round(byPerson.sin_asignar * 18)),
  };

  const totalHumanLoad = Object.values(byPerson).reduce((a, b) => a + b, 0) || 1;
  const dependenciaCritica =
    maxPerson && maxPerson[1] / totalHumanLoad >= 0.45 && maxPerson[0] !== 'sin_asignar'
      ? maxPerson[0]
      : null;

  const necesidadIntervencion =
    inactividadCritica ||
    ingresoBloqueado >= UMBRAL_INGRESO_BLOQUEADO_CLP ||
    oportunidadNoTomada > 0 ||
    Object.values(riesgoOperacionalPorPersona).some((x) => x >= 72);

  const humanSignals = {
    riesgoOperacionalPorPersona,
    dependenciaCritica,
    necesidadIntervencion,
    _meta: {
      outlookPendientes: { Romina: rominaP, Gery: geryP, Lyn: lynP },
      cargaOtAbiertaPorPersona: { ...byPerson },
    },
  };

  let priorityCodigo = 'flujo_operativo';
  let priorityLabel = 'Mantener cadencia operativa';
  if (ingresoBloqueado >= UMBRAL_INGRESO_BLOQUEADO_CLP) {
    priorityCodigo = 'liberar_ingresos';
    priorityLabel = 'Liberar ingresos (cierres + cobros)';
  } else if (oportunidadNoTomada > 0) {
    priorityCodigo = 'accion_comercial_inmediata';
    priorityLabel = 'Acción comercial inmediata';
  } else if (cuelloBotella === 'persona' && maxPerson?.[0]) {
    priorityCodigo = 'desbloquear_persona';
    priorityLabel = `Desbloquear flujo · ${maxPerson[0]}`;
  }

  const priorityEngine = {
    codigo: priorityCodigo,
    label: priorityLabel,
    umbralIngresoBloqueado: UMBRAL_INGRESO_BLOQUEADO_CLP,
    regla: 'Dinero primero: ingreso bloqueado > umbral, luego oportunidades sin gestión, luego cuello de botella humano.',
  };

  const calSobrecarga = (ctx.operationalCalendarAlerts || []).filter((a) => a.code === 'CAL_TEC_SOBRECARGA').length;

  const noiseToIgnore = [];
  if (calSobrecarga === 0) noiseToIgnore.push('Alertas de calendario duplicadas o sin sobrecarga real');
  if (!openOts.length) noiseToIgnore.push('Micro-variaciones de cola OT en vacío operativo');
  if (opps.length < 3) noiseToIgnore.push('Ruido fino de pipeline comercial con pocas oportunidades cargadas');

  const moneyLeakSummary = [];
  if (ingresoBloqueado > 0)
    moneyLeakSummary.push(`~$${Math.round(ingresoBloqueado).toLocaleString('es-CL')} potencialmente bloqueado en OT abiertas (cierre/cobro).`);
  if (fugaDinero > 0)
    moneyLeakSummary.push(`~$${Math.round(fugaDinero).toLocaleString('es-CL')} estimado por demora acumulada (heurística).`);
  if (oportunidadNoTomada > 0)
    moneyLeakSummary.push(`${oportunidadNoTomada} oportunidad(es) alta prioridad sin gestión >72h.`);

  const bottleneckPersonLabel =
    cuelloBotella === 'persona' && maxPerson?.[0]
      ? `${maxPerson[0]} concentra ~${share(maxPerson[1])}% de la carga OT abierta`
      : cuelloBotella === 'proceso'
        ? 'El cuello parece ser de proceso (pendientes / backlog oculto), no una sola persona.'
        : 'Patrón cliente / estancamiento disperso — revisar promesas y visitas.';

  const topImpactAction =
    priorityCodigo === 'liberar_ingresos'
      ? 'Cerrar y facturar OT listas: priorizar las con monto ya definido o visita completada.'
      : priorityCodigo === 'accion_comercial_inmediata'
        ? 'Llamar / mover estado en oportunidades urgentes pendientes (pipeline).'
        : priorityCodigo === 'desbloquear_persona'
          ? `Redistribuir o empujar tareas de ${maxPerson?.[0] || 'la persona más cargada'} hoy.`
          : 'Sostener ritmo: una victoria rápida (un cierre o un seguimiento comercial).';

  const mape = ctx.autonomicEnvelope;
  const jarvisDecisionLayer = buildJarvisDecisionLayer({
    flowState,
    economicState,
    priorityEngine,
    humanSignals,
    mape,
  });

  return {
    version: JARVIS_FLOW_INTEL_VERSION,
    computedAt: new Date().toISOString(),
    mantra: MANTRA,
    flowState,
    economicState,
    priorityEngine,
    humanSignals,
    jarvisDecisionLayer,
    hqNarrative: {
      dondeSePierdeDinero: moneyLeakSummary,
      personaFrenando: bottleneckPersonLabel,
      accionImpactoInmediato: topImpactAction,
      ignorarRuido: noiseToIgnore,
    },
  };
}

/**
 * @param {object} p
 * @param {object} p.flowState
 * @param {object} p.economicState
 * @param {object} p.priorityEngine
 * @param {object} p.humanSignals
 * @param {object} [p.mape]
 */
export function buildJarvisDecisionLayer(p) {
  const { flowState, economicState, priorityEngine, humanSignals, mape } = p;
  const focoPrincipal = priorityEngine.label;
  const accionRecomendada =
    priorityEngine.codigo === 'liberar_ingresos'
      ? 'Ejecutar cierres de OT y completar economía para destrabar cobro.'
      : priorityEngine.codigo === 'accion_comercial_inmediata'
        ? 'Gestionar oportunidades altas estancadas; actualizar estado en ERP.'
        : priorityEngine.codigo === 'desbloquear_persona'
          ? `Aliviar carga de ${humanSignals.dependenciaCritica || 'quien concentra OT'} con reassignment o bloque de tiempo.`
          : 'Proteger ventana de cierre semanal: una OT terminada y una oportunidad movida.';

  let impactoEsperado = 'Recuperación de flujo de caja y reducción de riesgo operativo percibido.';
  if (economicState.ingresoBloqueado > 0)
    impactoEsperado = `Hasta ~$${Math.round(economicState.ingresoBloqueado).toLocaleString('es-CL')} dejados de ingresar hasta cerrar/facturar.`;
  if (economicState.oportunidadNoTomada > 0)
    impactoEsperado += ` ${economicState.oportunidadNoTomada} opp. alta sin tocar — riesgo de fuga comercial.`;

  let urgenciaReal = 'media';
  if (flowState.inactividadCritica || economicState.ingresoBloqueado >= UMBRAL_INGRESO_BLOQUEADO_CLP * 1.4)
    urgenciaReal = 'critica';
  else if (economicState.oportunidadNoTomada > 0 || flowState.ritmo === 'bajo') urgenciaReal = 'alta';
  else if (flowState.ritmo === 'alto' && !flowState.inactividadCritica) urgenciaReal = 'baja';

  return {
    version: JARVIS_FLOW_INTEL_VERSION,
    focoPrincipal,
    accionRecomendada,
    impactoEsperado,
    urgenciaReal,
    mantra: MANTRA,
    mapeSalud: mape?.systemHealth ?? null,
    mapeRiesgo: mape?.riskLevel ?? null,
    prioridadCodigo: priorityEngine.codigo,
  };
}

/**
 * @param {ReturnType<typeof import('./jarvis-core.js').getJarvisUnifiedState>} unified
 */
export function buildJarvisFlowIntelligence(unified) {
  const u = unified || {};
  return computeJarvisFlowPack({
    planOts: u.planOts,
    outlookFollowUp: u.outlookFollowUp,
    commercialOpportunities: u.commercialOpportunities,
    commercialSummary: u.commercialSummary,
    operationalCalendarAlerts: u.operationalCalendarAlerts,
    autonomicEnvelope: u.autonomicState || null,
  });
}

/**
 * Base unificada (assembleJarvisUnifiedBase) + sobre MAPE opcional — para Pulse.
 * @param {object} unifiedBase
 * @param {object|null} mapeEnvelope
 */
export function buildJarvisFlowIntelligenceFromBase(unifiedBase, mapeEnvelope = null) {
  const b = unifiedBase || {};
  return computeJarvisFlowPack({
    planOts: b.planOts,
    outlookFollowUp: b.outlookFollowUp,
    commercialOpportunities: b.commercialOpportunities,
    commercialSummary: b.commercialSummary,
    operationalCalendarAlerts: b.operationalCalendarAlerts,
    autonomicEnvelope: mapeEnvelope,
  });
}
