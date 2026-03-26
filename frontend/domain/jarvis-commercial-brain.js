/**
 * Cerebro comercial Jarvis — detecta señales desde operación y arma propuestas concretas (texto + monto + servicio).
 * Un solo dato extra pedido al usuario: correo del cliente (para mailto / envío).
 */

import { clipText } from './jarvis-contextual-identity.js';

const MS_90D = 90 * 24 * 60 * 60 * 1000;

const SERVICIO_CATALOGO = {
  mantenimiento: {
    key: 'mantenimiento',
    tipoBackend: 'mantenimiento',
    label: 'Mantención preventiva programada',
    precioBase: 980000,
    alcance: 'Visitas planificadas, checklist térmico/ eléctrico y reporte mensual de estado.',
  },
  bolsa_horas: {
    key: 'bolsa_horas',
    tipoBackend: 'mejora',
    label: 'Bolsa de horas técnicas (40 h)',
    precioBase: 1250000,
    alcance: 'Bolsa 40 h con prioridad estándar y respuesta en ventana operativa acordada.',
  },
  contrato: {
    key: 'contrato',
    tipoBackend: 'mantenimiento',
    label: 'Contrato integral 12 meses',
    precioBase: 3200000,
    alcance: 'Cobertura programada + canal directo de incidencias + informes trimestrales.',
  },
  urgente: {
    key: 'urgente',
    tipoBackend: 'urgencia',
    label: 'Plan de respuesta urgente + estabilización',
    precioBase: 520000,
    alcance: 'Diagnóstico inmediato, contención del riesgo y plan de remediación en 72 h.',
  },
};

function normCliente(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isOtAbierta(o) {
  const st = String(o?.estado || '').toLowerCase();
  return st && !['terminado', 'cerrado', 'cancelado'].includes(st);
}

function isClimaOt(o) {
  return String(o?.tipoServicio || 'clima') !== 'flota';
}

function parseTs(iso) {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function countOtsByCliente(planOts, windowMs) {
  const now = Date.now();
  const map = new Map();
  for (const o of planOts || []) {
    if (!isClimaOt(o)) continue;
    const c = normCliente(o.cliente);
    if (!c) continue;
    const t = parseTs(o.updatedAt || o.creadoEn || o.createdAt);
    if (!Number.isFinite(t) || now - t > windowMs) continue;
    map.set(c, (map.get(c) || 0) + 1);
  }
  return map;
}

function displayClienteFromKey(key, planOts) {
  const k = key;
  for (const o of planOts || []) {
    if (normCliente(o.cliente) === k) return String(o.cliente || '').trim() || k;
  }
  return key;
}

function pickServicio({ repeatCount, incidencias, urgenteOps }) {
  if (urgenteOps || incidencias >= 2) return SERVICIO_CATALOGO.urgente;
  if (repeatCount >= 4) return SERVICIO_CATALOGO.contrato;
  if (repeatCount >= 2) return SERVICIO_CATALOGO.bolsa_horas;
  return SERVICIO_CATALOGO.mantenimiento;
}

function roundMoney(n) {
  const x = Math.round(Number(n) || 0);
  return Math.round(x / 10000) * 10000;
}

function buildCuerpoCorreo({ clienteDisplay, servicio, valor, operador }) {
  const op = String(operador || 'HNF').trim();
  return [
    `Estimado equipo de ${clienteDisplay},`,
    '',
    'Les compartimos propuesta operativa HNF:',
    '',
    `• Servicio: ${servicio.label}`,
    `• Alcance: ${servicio.alcance}`,
    `• Inversión referencial: $${valor.toLocaleString('es-CL')} + IVA (ajustable tras visita / inventario).`,
    '',
    'Si les interesa, coordinamos kick-off y ventana de visita en la próxima semana.',
    '',
    `Saludos,`,
    `${op} · HNF`,
  ].join('\n');
}

/**
 * @param {object} ctx
 * @param {object} ctx.unified
 * @param {object} ctx.data
 * @param {object} ctx.friction
 * @param {Array} ctx.oppsList - oportunidades API ya resueltas
 * @param {number} [ctx.comercialPot] - potencial declarado en brief diario
 */
export function buildJarvisCommercialBrain(ctx) {
  const unified = ctx.unified || {};
  const data = ctx.data || {};
  const friction = ctx.friction || {};
  const comercialPot = Math.round(Number(ctx.comercialPot) || 0);
  const cr = friction.capaRealidad || {};
  const planOts = Array.isArray(unified.planOts) ? unified.planOts : [];
  const opEvents = Array.isArray(data.operationalEvents) ? data.operationalEvents : [];
  const waMsgs = Array.isArray(data.whatsappFeed?.messages) ? data.whatsappFeed.messages : [];
  const oppsList = Array.isArray(ctx.oppsList) ? ctx.oppsList : [];

  const bloqueado = Math.round(Number(cr.ingresoBloqueado) || 0);
  const proyectado = Math.round(Number(cr.ingresoProyectado) || 0);

  const byCliente = countOtsByCliente(planOts, MS_90D);
  let topClienteKey = '';
  let topCount = 0;
  for (const [c, n] of byCliente) {
    if (n > topCount) {
      topCount = n;
      topClienteKey = c;
    }
  }

  let incidencias = 0;
  for (const e of opEvents) {
    const t = String(e.tipo_evento || e.tipo || '').toLowerCase();
    if (t.includes('incid')) incidencias += 1;
  }

  const waClima = waMsgs.filter((w) => String(w.tipo || '').toLowerCase() !== 'flota');
  const waByCliente = new Map();
  for (const w of waClima) {
    const c = normCliente(w.cliente);
    if (!c) continue;
    waByCliente.set(c, (waByCliente.get(c) || 0) + 1);
  }

  let topWaCliente = '';
  let topWaN = 0;
  for (const [c, n] of waByCliente) {
    if (n > topWaN) {
      topWaN = n;
      topWaCliente = c;
    }
  }

  const otsAbiertas = planOts.filter((o) => isOtAbierta(o) && isClimaOt(o));
  const urgenteOps = otsAbiertas.some((o) => {
    const st = String(o.prioridad || o.urgencia || '').toLowerCase();
    return st.includes('urg') || st.includes('crit');
  });

  const topOpp = oppsList[0];
  let clienteDisplay = '';
  let fuente = 'cartera';
  let repeatCount = topCount;
  let opportunityId = null;

  if (topOpp && String(topOpp.cliente || '').trim()) {
    clienteDisplay = String(topOpp.cliente || '').trim();
    fuente = 'oportunidad_api';
    opportunityId = topOpp.id || null;
    const k = normCliente(clienteDisplay);
    repeatCount = byCliente.get(k) || repeatCount || 1;
  } else if (topClienteKey) {
    clienteDisplay = displayClienteFromKey(topClienteKey, planOts);
    fuente = 'ot_repetida';
  } else if (topWaCliente) {
    clienteDisplay = displayClienteFromKey(topWaCliente, planOts) || topWaCliente;
    fuente = 'whatsapp_activo';
    repeatCount = Math.max(2, topWaN);
  } else if (otsAbiertas[0]) {
    clienteDisplay = String(otsAbiertas[0].cliente || 'Cliente activo').trim();
    fuente = 'ot_abierta';
    repeatCount = 1;
  } else if (comercialPot > 0) {
    clienteDisplay = 'Cartera · brief';
    fuente = 'potencial_declarado';
    repeatCount = 2;
  } else {
    clienteDisplay = 'Cartera prioritaria';
    fuente = 'default';
    repeatCount = 1;
  }

  const servicio = pickServicio({ repeatCount, incidencias, urgenteOps });
  let valorEstimado = roundMoney(servicio.precioBase + repeatCount * 120000 + incidencias * 180000);
  if (topOpp && Number(topOpp.estimacionMonto) > 0) {
    valorEstimado = roundMoney(Math.max(valorEstimado, Number(topOpp.estimacionMonto)));
  }
  if (comercialPot > 0) {
    valorEstimado = roundMoney(Math.max(valorEstimado, comercialPot * 0.35));
  }

  const operador = String(ctx.operatorName || '').trim() || 'Equipo';
  const asunto = `Propuesta HNF · ${servicio.label} · ${clienteDisplay}`;

  const cuerpoCorreo = buildCuerpoCorreo({
    clienteDisplay,
    servicio,
    valor: valorEstimado,
    operador,
  });

  const propuestaLinea = clipText(
    `${servicio.label} · ~$${valorEstimado.toLocaleString('es-CL')} + IVA · ${clienteDisplay}`,
    96
  );

  const accionComercial = clipText(
    fuente === 'oportunidad_api'
      ? `Cerrar cotización formal sobre oportunidad registrada · ${clienteDisplay}`
      : repeatCount >= 2
        ? `${repeatCount} OT en 90 días — proponer ${servicio.label.toLowerCase()} y anclar SLA`
        : `Abrir conversión comercial con ${clienteDisplay} sobre ${servicio.label.toLowerCase()}`,
    110
  );

  const detecta = clipText(
    fuente === 'ot_repetida'
      ? `${repeatCount} OT clima en 90 días en ${clienteDisplay} — patrón de demanda recurrente`
      : fuente === 'whatsapp_activo'
        ? `${topWaN} ingresos WhatsApp recientes · ${clienteDisplay}`
        : fuente === 'oportunidad_api'
          ? `Oportunidad en pipeline: ${clipText(topOpp.descripcion || topOpp.titulo || 'seguimiento', 72)}`
          : fuente === 'potencial_declarado'
            ? `Potencial declarado ~$${comercialPot.toLocaleString('es-CL')} — convertir en propuesta cerrada`
            : incidencias >= 2
              ? `${incidencias} incidencias operativas — ofrecer contención + plan`
              : `OT y operación activa — propuesta ${servicio.label.toLowerCase()}`,
    120
  );

  const operarHoy = clipText(
    bloqueado > 0
      ? `Despejar cierre/evidencias: ~$${bloqueado.toLocaleString('es-CL')} detenidos`
      : 'Mantener ritmo de cierre y cobro en OT abiertas',
    88
  );

  const venderHoy = clipText(
    `${accionComercial} · enviar propuesta con valor ~$${valorEstimado.toLocaleString('es-CL')}`,
    88
  );

  const dineroLine = clipText(
    bloqueado > 0
      ? `Detenido ~$${bloqueado.toLocaleString('es-CL')}${proyectado > 0 ? ` · proyectado hoy ~$${proyectado.toLocaleString('es-CL')}` : ''}`
      : proyectado > 0
        ? `Proyectado hoy ~$${proyectado.toLocaleString('es-CL')} · empujar cierres`
        : 'Sin bloqueo fuerte en datos — priorizar conversión',
    100
  );

  return {
    cliente: clienteDisplay,
    clienteNorm: normCliente(clienteDisplay),
    fuente,
    opportunityId,
    servicioKey: servicio.key,
    tipoServicioBackend: servicio.tipoBackend,
    servicioLabel: servicio.label,
    valorEstimado,
    asunto,
    cuerpoCorreo,
    propuestaLinea,
    accionComercial,
    detecta,
    gerencial: {
      operarHoy,
      venderHoy,
      dineroLine,
    },
  };
}

/**
 * Arma payload para navegar a Oportunidades con borrador (y opcionalmente mailto).
 */
export function commercialDraftPayload(brain, clienteEmail = '') {
  const email = String(clienteEmail || '').trim();
  return {
    mode: 'draft',
    cliente: brain.cliente,
    clienteEmail: email,
    servicioTipo: brain.tipoServicioBackend,
    servicioLabel: brain.servicioLabel,
    servicioKey: brain.servicioKey,
    valorEstimado: brain.valorEstimado,
    asunto: brain.asunto,
    cuerpoCorreo: brain.cuerpoCorreo,
    opportunityId: brain.opportunityId || null,
    propuestaLinea: brain.propuestaLinea,
    accionComercial: brain.accionComercial,
  };
}

export function buildMailtoUrl(email, asunto, cuerpo) {
  const q = new URLSearchParams();
  q.set('subject', asunto || 'Propuesta HNF');
  q.set('body', cuerpo || '');
  const e = String(email || '').trim();
  if (e.includes('@')) return `mailto:${e}?${q.toString()}`;
  return `mailto:?${q.toString()}`;
}
