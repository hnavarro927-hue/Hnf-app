/**
 * Jarvis — fricción operativa, modo presión y autoacciones (empuja decisión; no solo observa).
 */

import { adjustHeuristics } from './jarvis-memory.js';

export const JARVIS_FRICTION_PRESSURE_VERSION = '2026-03-23';

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

const normEstado = (o) =>
  String(o?.estado || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isClosed = (o) => normEstado(o) === 'terminado';
const isClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
};

const hoursSinceCreated = (o) => {
  const t = parseTs(o.fechaCreacion || o.creadoEn || o.createdAt || o.actualizadoEn);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
};

/**
 * @param {object} unified - getJarvisUnifiedState (con jarvisFlowIntelligence, jarvisOperador, outlook…)
 */
export function buildJarvisFrictionPressure(unified) {
  const u = unified || {};
  const fi = u.jarvisFlowIntelligence || {};
  const flow = fi.flowState || {};
  const econ = fi.economicState || {};
  const meta = flow._meta || {};
  const op = u.jarvisOperador || {};
  const ml = op.moneyLeaks || {};
  const hidden = op.hiddenErrors || { items: [] };
  const planOts = Array.isArray(u.planOts) ? u.planOts : [];
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const msgs = Array.isArray(u.outlookFeed?.messages) ? u.outlookFeed.messages : [];
  const delayAlerts = Array.isArray(u.outlookFollowUp?.delayAlerts) ? u.outlookFollowUp.delayAlerts : [];

  const openOts = planOts.filter((o) => isClima(o) && !isClosed(o));
  const otOver3d = openOts.filter((o) => {
    const dF = daysSince(o.fecha);
    const dU = daysSince(o.updatedAt);
    const d = [dF, dU].filter((x) => x != null);
    return d.length && Math.max(...d) > 3;
  });
  const oppStale72 = opps.filter((o) => {
    if (!['pendiente', 'cotizado'].includes(String(o.estado || '').toLowerCase())) return false;
    const h = hoursSinceCreated(o);
    return h != null && h > 72;
  });
  const critMail = msgs.filter(
    (m) =>
      (m.priorityHint === 'crítica' || m.priorityHint === 'critica' || m.severity === 'critical') &&
      m.status !== 'cerrado'
  );
  const critDelay = delayAlerts.filter((a) => a.severity === 'critical');
  const hiddenCrit = (hidden.items || []).filter((e) => e.severidad === 'critical');
  const hiddenBacklog = Number(meta.hiddenBacklogCount || 0);
  const sinPipeline = opps.length === 0;

  /** @type {{ codigo: string, texto: string, severidad: 'info'|'warning'|'critica' }[]} */
  const fricciones = [];

  if (otOver3d.length) {
    fricciones.push({
      codigo: 'ot_abierta_3d',
      texto: `${otOver3d.length} OT abierta(s) con más de 3 días de antigüedad o sin movimiento reciente.`,
      severidad: otOver3d.length >= 4 ? 'critica' : 'warning',
    });
  }
  const staleCount = Math.max(oppStale72.length, Number(econ.oportunidadNoTomada || 0));
  if (staleCount > 0) {
    fricciones.push({
      codigo: 'opp_sin_gestion_72h',
      texto: `${staleCount} oportunidad(es) sin gestión efectiva >72h (alta prioridad / cotizado).`,
      severidad: staleCount >= 3 ? 'critica' : 'warning',
    });
  }
  if (critMail.length || critDelay.length) {
    fricciones.push({
      codigo: 'correo_critico',
      texto: `${critMail.length} correo(s) con señal crítica activa · ${critDelay.length} alerta(s) de demora crítica.`,
      severidad: 'critica',
    });
  }
  if (hiddenBacklog >= 3) {
    fricciones.push({
      codigo: 'backlog_tecnico_oculto',
      texto: `Backlog técnico oculto: ${hiddenBacklog} OT en cola “pendiente” con días sin actualizar.`,
      severidad: 'warning',
    });
  }
  if (hiddenCrit.length) {
    fricciones.push({
      codigo: 'hallazgos_ocultos',
      texto: `${hiddenCrit.length} hallazgo(s) crítico(s) en revisión documental / correo.`,
      severidad: 'critica',
    });
  }
  if (sinPipeline && openOts.length > 0) {
    fricciones.push({
      codigo: 'sin_pipeline_con_obra',
      texto: 'Hay OT abiertas pero pipeline comercial vacío: riesgo de mes sin palanca comercial.',
      severidad: 'warning',
    });
  }
  if (sinPipeline && !openOts.length) {
    fricciones.push({
      codigo: 'sin_pipeline',
      texto: 'Sin oportunidades cargadas: Jarvis no puede empujar cierres comerciales.',
      severidad: 'warning',
    });
  }

  const urg = ml.urgencia || op.urgencyEngine?.nivel || 'media';
  const critF = fricciones.filter((f) => f.severidad === 'critica').length;
  const warnF = fricciones.filter((f) => f.severidad === 'warning').length;

  let nivel = 'baja';
  if (urg === 'critica' || critF >= 2 || (critMail.length && urg === 'alta')) {
    nivel = 'alta';
  } else if (urg === 'alta' || critF >= 1 || warnF >= 2 || flow.ritmo === 'bajo' || flow.inactividadCritica) {
    nivel = 'media';
  } else if (warnF >= 1 || fricciones.length > 0) {
    nivel = 'media';
  }

  const { pressureBias } = adjustHeuristics();
  if (pressureBias > 0) {
    if (nivel === 'baja' && fricciones.length > 0) nivel = 'media';
    else if (nivel === 'media') nivel = 'alta';
  }

  const activo = nivel !== 'baja' || urg !== 'media' || fricciones.length > 0;

  const tipoPresion =
    nivel === 'alta' ? 'accion_obligatoria_visible' : nivel === 'media' ? 'accion_recomendada' : 'sugerencia';

  const alertaDirecta =
    nivel === 'alta'
      ? 'MODO PRESIÓN ACTIVA (alta): el núcleo exige decisión ejecutable hoy — sin posponer.'
      : nivel === 'media'
        ? 'MODO PRESIÓN ACTIVA (media): acción recomendada con fecha en las próximas 24–48h.'
        : null;

  const topOt = otOver3d[0] || openOts[0];
  const topOpp = opps[0];
  const montoOpp = topOpp
    ? roundMoney(topOpp.montoEstimado || topOpp.valorEstimado || topOpp.monto || 0)
    : 0;
  const clienteOpp = topOpp?.cliente || topOpp?.nombreCliente || 'cliente prioridad';

  /** @type {string[]} */
  const hacerHoy = [];
  /** @type {string[]} */
  const bloqueoCritico = [];
  /** @type {string[]} */
  const oportunidadInmediata = [];

  if (topOt) {
    const d = Math.max(
      daysSince(topOt.fecha) ?? 0,
      daysSince(topOt.updatedAt) ?? 0,
      0
    );
    hacerHoy.push(`Despachar / cerrar avance OT ${topOt.id || '—'} hoy — lleva ~${Math.round(d)} día(s) abierta.`);
  } else {
    hacerHoy.push('Definir una sola OT u oportunidad #1 y asignar dueño con hora límite hoy.');
  }

  if (ml.ingresoBloqueado > 0 || econ.ingresoBloqueado > 0) {
    bloqueoCritico.push(
      `Dinero bloqueado ~$${roundMoney(ml.ingresoBloqueado || econ.ingresoBloqueado).toLocaleString('es-CL')}: elegir un desbloqueo (cierre, evidencia o cobro) antes del fin del día.`
    );
  }
  if (hiddenCrit[0]) {
    bloqueoCritico.push(`Resolver hallazgo: ${hiddenCrit[0].titulo || hiddenCrit[0].codigo} — frena cierre limpio.`);
  }
  if (!bloqueoCritico.length) {
    bloqueoCritico.push('Sin bloqueo monetario explícito en datos: igual forzá un cierre administrativo pendiente (doc o correo).');
  }

  if (topOpp && montoOpp > 0) {
    oportunidadInmediata.push(
      `Contactar ${clienteOpp} hoy — potencial ~$${montoOpp.toLocaleString('es-CL')} · siguiente paso con hora.`
    );
  } else if (critMail[0]) {
    oportunidadInmediata.push(
      `Responder correo crítico en ≤2h (${critMail[0].subject || critMail[0].id || 'ref'}) — riesgo de fuga de cliente.`
    );
  } else {
    oportunidadInmediata.push(
      'Registrar 1 oportunidad con monto tentativo o convertir visita técnica en propuesta en 48h.'
    );
  }

  const capaRealidad = {
    ingresoProyectado: roundMoney(econ.ingresoProyectadoHoy ?? 0),
    ingresoBloqueado: roundMoney(ml.ingresoBloqueado ?? econ.ingresoBloqueado ?? 0),
    fugaDinero: roundMoney(ml.fugaDinero ?? econ.fugaDinero ?? 0),
    riesgoOperativo: flow.inactividadCritica ? 'alto' : flow.ritmo === 'bajo' ? 'elevado' : 'acotado',
    oportunidadUpsell: (op.opportunityDiscovery?.oportunidades || []).length || (op.opportunityEngine ? 1 : 0),
    otAbiertas: meta.openCount ?? openOts.length,
    backlogOculto: hiddenBacklog,
  };

  const intensidadNucleo = nivel === 'alta' ? 3 : nivel === 'media' ? 2 : 1;
  const estadoNucleo = nivel === 'alta' ? 'CRÍTICO' : nivel === 'media' ? 'EN PRESIÓN' : 'ESTABLE';
  const etiquetaPublica = nivel === 'alta' ? 'accion_obligatoria' : nivel === 'media' ? 'alerta' : 'normal';

  return {
    version: JARVIS_FRICTION_PRESSURE_VERSION,
    computedAt: new Date().toISOString(),
    capaRealidad,
    fricciones: fricciones.slice(0, 8),
    modoPresion: {
      activo,
      nivel,
      tipoPresion,
      alertaDirecta,
      intensidadNucleo,
      estadoNucleo,
      etiquetaPublica,
    },
    autoacciones: {
      hacerHoy: hacerHoy.slice(0, 3),
      bloqueoCritico: bloqueoCritico.slice(0, 3),
      oportunidadInmediata: oportunidadInmediata.slice(0, 3),
    },
    reglaDeOro:
      'Solo mostrar lo que empuja acción, mueve dinero o baja riesgo; el resto es ruido operativo.',
  };
}
