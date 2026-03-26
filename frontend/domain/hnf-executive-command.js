/**
 * Mando ejecutivo — una lectura: operación hoy, canales, riesgo, validación, modo de decisión.
 * Consume viewData + contexto ya calculado en buildHnfAdnSnapshot (evita duplicar agregados pesados).
 */

import { getControlState } from './jarvis-control-center.js';
import { buildJarvisCentroResumen } from './hnf-jarvis-centro-resumen.js';

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isTodayTs(raw) {
  const t = new Date(raw || 0).getTime();
  return Number.isFinite(t) && t >= startOfTodayMs();
}

function mapDecisionMode(jarvisMode) {
  const m = String(jarvisMode || 'observe');
  if (m === 'autonomic_safe') return { key: 'auto', label: 'Automático (seguro)' };
  if (m === 'assist') return { key: 'assist', label: 'Asistido' };
  if (m === 'off') return { key: 'manual', label: 'Manual (último estado)' };
  return { key: 'assist', label: 'Asistido (observación activa)' };
}

function fmtMoney(n) {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

/**
 * @param {object} data - viewData
 * @param {object} [ctx] - Contexto desde buildHnfAdnSnapshot (opcional)
 */
export function buildExecutiveCommandModel(data, ctx = null) {
  const d = data && typeof data === 'object' ? data : {};
  const centro = buildJarvisCentroResumen(d);
  const ctrl = getControlState();
  const decisionMode = mapDecisionMode(ctrl.jarvisMode);

  const ots = Array.isArray(d.planOts) ? d.planOts : d.ots?.data ?? [];
  const cards = Array.isArray(ctx?.cards) ? ctx.cards : [];
  const otCriticas = cards.filter((c) => c.global === 'rojo').length;

  const wa = Array.isArray(d.whatsappFeed?.messages) ? d.whatsappFeed.messages : [];
  const whatsappHoy =
    ctx?.whatsappHoy ??
    wa.filter((m) => isTodayTs(m.updatedAt || m.createdAt)).length;

  const outlook = Array.isArray(d.outlookFeed?.messages) ? d.outlookFeed.messages : [];
  const correosHoy = outlook.filter((m) => isTodayTs(m.receivedAt || m.date || m.createdAt)).length;

  const sol = Array.isArray(d.flotaSolicitudes) ? d.flotaSolicitudes : [];
  const flotaAbiertas = sol.filter((s) => String(s?.estado || '').toLowerCase() !== 'cerrada').length;

  const hnfSol = Array.isArray(d.hnfCoreSolicitudes) ? d.hnfCoreSolicitudes : [];
  const stats = ctx?.hnfCoreSolicitudStats ?? null;
  const solicitudesActivas =
    stats?.activas ??
    hnfSol.filter((s) => s.estado && String(s.estado).toLowerCase() !== 'cerrado').length;

  const pendienteAprobacion =
    stats?.pendienteAprobacion ??
    hnfSol.filter((s) => String(s?.estado || '').toLowerCase() === 'pendiente_aprobacion').length;

  const techDocs = Array.isArray(d.technicalDocuments) ? d.technicalDocuments : [];
  const docsObservados = techDocs.filter((x) => String(x?.estado || '').toLowerCase() === 'observado').length;

  const dineroEnRiesgo = Number(ctx?.dineroEnRiesgo ?? d.hnfAdn?.dineroEnRiesgo ?? 0) || 0;
  const principalProblema = ctx?.principalProblema || d.hnfAdn?.principalProblema || 'Sin foco crítico en este corte.';
  const recomendacion =
    ctx?.recomendacion ||
    d.hnfAdn?.recomendacion ||
    'Revisá la bandeja de ingreso y el calendario del día.';

  const bottleneck = ctx?.bottleneck || d.hnfAdn?.bottleneck || null;
  const responsableSugerido = bottleneck?.tecnico
    ? String(bottleneck.tecnico).trim()
    : bottleneck?.cliente
      ? `Cliente: ${bottleneck.cliente}`
      : 'Coordinación';

  const alertasEjecutivas = [];

  if (centro.requiereValidacion > 0) {
    alertasEjecutivas.push({
      tipo: 'validacion',
      titulo: 'Hay datos para revisar',
      detalle: `${centro.requiereValidacion} ítem(es) esperan tu confirmación antes de memorizar.`,
      nav: { view: 'hnf-core' },
    });
  }
  if (pendienteAprobacion > 0) {
    alertasEjecutivas.push({
      tipo: 'aprobacion',
      titulo: 'Pendiente de aprobación',
      detalle: `${pendienteAprobacion} solicitud(es) en revisión.`,
      nav: { view: 'hnf-core' },
    });
  }
  if (otCriticas > 0) {
    alertasEjecutivas.push({
      tipo: 'ot',
      titulo: 'OT que requieren atención',
      detalle: `${otCriticas} orden(es) con señal crítica en control de tiempo.`,
      nav: { view: 'clima' },
    });
  }
  if (docsObservados > 0) {
    alertasEjecutivas.push({
      tipo: 'documento',
      titulo: 'Documentos observados',
      detalle: `${docsObservados} documento(s) con observaciones.`,
      nav: { view: 'documentos-tecnicos' },
    });
  }

  const comm = Array.isArray(d.commercialOpportunities) ? d.commercialOpportunities : [];
  const commUrg = comm.filter((c) => String(c?.prioridad || '').toLowerCase() === 'urgente').length;
  if (commUrg > 0) {
    alertasEjecutivas.push({
      tipo: 'comercial',
      titulo: 'Oportunidades urgentes',
      detalle: `${commUrg} registro(s) marcados como urgentes.`,
      nav: { view: 'oportunidades' },
    });
  }

  const lineaOperacionHoy = `WhatsApp hoy: ${whatsappHoy} · Correos hoy: ${correosHoy} · Solicitudes unificadas: ${solicitudesActivas} · Flota abierta: ${flotaAbiertas}`;

  return {
    decisionMode,
    centro,
    whatsappHoy,
    correosHoy,
    solicitudesActivas,
    flotaAbiertas,
    otCriticas,
    pendienteAprobacion,
    dineroEnRiesgo,
    dineroEnRiesgoLabel: dineroEnRiesgo > 0 ? `$${fmtMoney(dineroEnRiesgo)} en operación abierta` : 'Sin monto destacado en riesgo',
    principalProblema,
    recomendacion,
    responsableSugerido,
    accionSugerida: recomendacion,
    lineaOperacionHoy,
    alertasEjecutivas,
    solicitudesCoreTotal: hnfSol.length,
  };
}
