/**
 * ADN HNF — capa lógica única derivada de `viewData` (resultado de loadFullOperationalData).
 * Consolida OT + eventos + costos/riesgo + clientes + señales orbitales.
 * Jarvis / mando principal deben preferir `data.hnfAdn` y no recomputar este snapshot salvo fallback.
 */

import { buildControlOperativoAlertas, buildControlOperativoCards } from './control-operativo-tiempo-real.js';
import { aggregateMandoFromEventos, buildFlujoOperativoUnificado } from './evento-operativo.js';
import { computeHnfCoreSolicitudStats } from './hnf-core-hub.js';
import { buildExecutiveCommandModel } from './hnf-executive-command.js';
import { buildJarvisCentroResumen } from './hnf-jarvis-centro-resumen.js';
import { buildJarvisLiveOrbitModel } from './hnf-jarvis-live-orbit.js';

/** @param {object} data - Misma forma que state.viewData tras loadFullOperationalData */
export function buildHnfAdnSnapshot(data) {
  const d = data && typeof data === 'object' ? data : {};
  const eventosUnificados = buildFlujoOperativoUnificado(d);
  const agg = aggregateMandoFromEventos(eventosUnificados);
  const cards = buildControlOperativoCards(d);
  const alertas = buildControlOperativoAlertas(cards);

  const bloqueos = cards.filter((c) => c.global === 'rojo').length;
  const pendientes = cards.filter((c) => c.global === 'naranja').length;
  const ok = cards.filter((c) => c.global === 'verde').length;

  const rank = { rojo: 0, naranja: 1, verde: 2 };
  const sortedWorst = [...cards].sort(
    (a, b) => (rank[a.global] ?? 9) - (rank[b.global] ?? 9)
  );
  const bottleneck = sortedWorst.find((c) => c.global !== 'verde') || null;

  const problemParts = [];
  if (alertas.sinInformeTecnico > 0) {
    problemParts.push(`${alertas.sinInformeTecnico} OT sin informe técnico`);
  }
  if (alertas.pendientesAdmin > 0) {
    problemParts.push(`${alertas.pendientesAdmin} OT pendientes administración`);
  }
  if (alertas.noEnviadasCliente > 0) {
    problemParts.push(`${alertas.noEnviadasCliente} OT no enviadas al cliente`);
  }

  const principalProblema =
    problemParts[0] ||
    (agg.estado_general === 'critico'
      ? 'Operación en estado crítico: revisar cola de OT y evidencias.'
      : agg.estado_general === 'atencion'
        ? 'Hay fricción operativa que conviene despejar hoy.'
        : 'Operación estable: mantener ritmo y anticipar calendario / comercial.');

  const recomendacion = bottleneck
    ? `Priorizar ${bottleneck.otId} (${bottleneck.cliente}): técnico ${bottleneck.tecnico} — cerrar evidencias antes de sumar carga nueva.`
    : cards.length && ok === cards.length
      ? 'Pipeline en buen estado: anticipá comercial y calendario de la semana.'
      : 'Avanzá la acción sugerida y validá evidencias en Clima.';

  const sol = Array.isArray(d.flotaSolicitudes) ? d.flotaSolicitudes : [];
  const flotaAbierta = sol.filter((s) => String(s?.estado || '').toLowerCase() !== 'cerrada').length;

  const calAlerts = Array.isArray(d.operationalCalendarAlerts) ? d.operationalCalendarAlerts : [];
  const planFriccion = calAlerts.filter(
    (a) => a?.severity === 'critical' || a?.severity === 'warning'
  ).length;

  const comm = Array.isArray(d.commercialOpportunities) ? d.commercialOpportunities : [];
  const commAlert = Array.isArray(d.commercialOpportunityAlerts) ? d.commercialOpportunityAlerts : [];

  const wa = Array.isArray(d.whatsappFeed?.messages) ? d.whatsappFeed.messages : [];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const whatsappHoy = wa.filter((m) => {
    const t = new Date(m.updatedAt || m.createdAt || 0).getTime();
    return Number.isFinite(t) && t >= dayStart.getTime();
  }).length;

  const opsEv = Array.isArray(d.operationalEvents) ? d.operationalEvents : [];
  const controlBadge = opsEv.filter((e) => e && String(e.estado || '').toLowerCase() !== 'cerrado').length;

  const hnfCoreSolicitudes = Array.isArray(d.hnfCoreSolicitudes) ? d.hnfCoreSolicitudes : [];
  const hnfCoreSolicitudStats = computeHnfCoreSolicitudStats(hnfCoreSolicitudes);

  const jarvisLiveOrbit = buildJarvisLiveOrbitModel(d, {
    eventosUnificados,
    cards,
    alertas,
    traffic: { bloqueos, pendientes, ok, totalOt: cards.length },
    bottleneck,
    whatsappHoy,
    dineroEnRiesgo: agg.dinero_en_riesgo,
    principalProblema,
    hnfCoreSolicitudStats,
  });

  const comercialBadgeLive = Math.max(
    commAlert.length || comm.length,
    jarvisLiveOrbit.commercialLive?.pressureScore ?? 0
  );

  const jarvisCentroResumen = buildJarvisCentroResumen(d);
  const executiveCommand = buildExecutiveCommandModel(d, {
    cards,
    bottleneck,
    principalProblema,
    recomendacion,
    whatsappHoy,
    dineroEnRiesgo: agg.dinero_en_riesgo,
    hnfCoreSolicitudStats,
    alertas,
  });

  return {
    version: 1,
    estadoGeneral: agg.estado_general,
    dineroEnRiesgo: agg.dinero_en_riesgo,
    totalEventosActivos: agg.total_activos,
    eventosUnificados,
    cards,
    alertas,
    traffic: { bloqueos, pendientes, ok, totalOt: cards.length },
    bottleneck,
    principalProblema,
    recomendacion,
    whatsappHoy,
    jarvisLiveOrbit,
    hnfCoreSolicitudes,
    hnfCoreSolicitudStats,
    commercialLive: jarvisLiveOrbit.commercialLive,
    jarvisCentroResumen,
    executiveCommand,
    orbits: {
      clima: { view: 'clima', label: 'Clima', badge: bloqueos + pendientes, hint: 'OT · visitas' },
      flota: { view: 'flota', label: 'Flota', badge: flotaAbierta, hint: 'Solicitudes' },
      planificacion: {
        view: 'planificacion',
        label: 'Planificación',
        badge: planFriccion || calAlerts.length,
        hint: 'Calendario' },
      comercial: {
        view: 'oportunidades',
        label: 'Comercial',
        badge: comercialBadgeLive,
        hint: jarvisLiveOrbit.commercialLive?.accionesSugeridas?.[0] || 'Pipeline vivo',
      },
      control: { view: 'control-gerencial', label: 'Control', badge: controlBadge, hint: 'Gerencial' },
    },
  };
}
