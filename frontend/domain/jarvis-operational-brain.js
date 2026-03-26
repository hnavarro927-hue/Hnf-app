/**
 * Cerebro operativo visible — vacíos, salud, decisión y distribución (solo lectura de estado existente).
 */

import { getEvidenceGaps } from '../utils/ot-evidence.js';
import { suggestedResponsible, vacuumCopyForStableKey } from './jarvis-channel-intelligence.js';

function assigneeFromChannelId(channelId, prioridad, fallback) {
  const s = suggestedResponsible(channelId, 'otro', prioridad);
  if (!s) return fallback;
  return s.includes('·') ? s.split('·')[0].trim() : s;
}

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

const parseOtActivityTs = (ot) => {
  const raw = ot?.updatedAt || ot?.fechaVisita || ot?.createdAt || ot?.creadoEn || ot?.cerradoEn;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now();
};

const formatAgeFromMs = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  if (h < 24) return h <= 1 ? '1h' : `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 día' : `${d} días`;
};

const roundMoney = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function saludoContextual() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días Hernan.';
  if (h < 19) return 'Hernan,';
  return 'Hernan,';
}

/**
 * @param {object} input
 */
export function buildJarvisOperationalBrain(input) {
  const {
    unified,
    board,
    friction,
    alienDecision,
    dataVacuum,
    integrationStatus,
    centroLast,
    outlookN,
    waN,
    planOtsN,
    docsN,
    oppsN,
    calEntriesN,
    calAlertsN,
    liveDigestFirst,
    boardN,
    alertsN,
  } = input;

  const planOts = Array.isArray(unified?.planOts) ? unified.planOts : [];
  let otsConVaciosEvidencia = 0;
  let totalGaps = 0;
  let evidenceGapOldestMs = 0;
  const openOts = planOts.filter((o) => String(o?.estado || '') !== 'terminado');
  for (const ot of openOts) {
    const g = getEvidenceGaps(ot);
    if (g.length) {
      otsConVaciosEvidencia += 1;
      totalGaps += g.length;
      const age = Date.now() - parseOtActivityTs(ot);
      if (age > evidenceGapOldestMs) evidenceGapOldestMs = age;
    }
  }

  const vacios = [];

  if (otsConVaciosEvidencia > 0) {
    vacios.push({
      stableKey: 'ot_evidencia',
      origen: 'OT',
      assignee: 'Romina',
      headline: `Faltan evidencias en ${otsConVaciosEvidencia} OT`,
      impacto: 'Impacto: cierre detenido o con riesgo de rechazo.',
      accion: 'Acción: cargar fotos ahora (antes / durante / después).',
      prioridad: 'CRITICO',
      tiempoSinAccion: formatAgeFromMs(evidenceGapOldestMs),
    });
  }

  if (integrationStatus === 'conectado' && outlookN === 0) {
    const v = vacuumCopyForStableKey('outlook_feed_vacio');
    vacios.push({
      stableKey: 'outlook_feed_vacio',
      origen: 'Correo',
      assignee: assigneeFromChannelId(v?.channel_id, 'ALTO', 'Gery'),
      channel_id: v?.channel_id,
      headline: v?.headline || 'Sin correos cargados en vista',
      impacto: v?.impacto || 'Impacto: sin seguimiento comercial desde bandeja.',
      accion: v?.accion || 'Acción: ingresar correos o activar intake Outlook.',
      prioridad: 'ALTO',
      tiempoSinAccion: '—',
    });
  }

  if (waN === 0 && integrationStatus === 'conectado') {
    const v = vacuumCopyForStableKey('whatsapp_feed_vacio');
    vacios.push({
      stableKey: 'whatsapp_feed_vacio',
      origen: 'WhatsApp',
      assignee: assigneeFromChannelId(v?.channel_id, 'NORMAL', 'Gery'),
      channel_id: v?.channel_id,
      headline: v?.headline || 'Sin mensajes WhatsApp en feed',
      impacto: v?.impacto || 'Impacto: conversaciones operativas no visibles.',
      accion: v?.accion || 'Acción: sincronizar feed o pegar conversación en ingesta.',
      prioridad: 'NORMAL',
      tiempoSinAccion: '—',
    });
  }

  if (oppsN === 0 && integrationStatus === 'conectado') {
    vacios.push({
      stableKey: 'oportunidades_vacio',
      origen: 'Comercial',
      assignee: 'Gery',
      headline: 'Sin oportunidades en pipeline',
      impacto: 'Impacto: proyección comercial ciega.',
      accion: 'Acción: cargar informes aprobados o crear oportunidad.',
      prioridad: 'ALTO',
      tiempoSinAccion: '—',
    });
  }

  if (calEntriesN === 0 && integrationStatus === 'conectado') {
    vacios.push({
      stableKey: 'calendario_vacio',
      origen: 'Calendario',
      assignee: 'Gery',
      headline: 'Calendario operativo vacío o sin entradas visibles',
      impacto: 'Impacto: riesgo de choques y visitas sin cobertura.',
      accion: 'Acción: cargar planificación / calendario.',
      prioridad: 'ALTO',
      tiempoSinAccion: '—',
    });
  } else if (calAlertsN > 2) {
    vacios.push({
      stableKey: 'calendario_alertas',
      origen: 'Calendario',
      assignee: 'Gery',
      headline: `${calAlertsN} alertas de calendario activas`,
      impacto: 'Impacto: sobrecarga técnica o continuidad en riesgo.',
      accion: 'Acción: revisar calendario y reasignar ventanas.',
      prioridad: 'ALTO',
      tiempoSinAccion: '—',
    });
  }

  if (docsN === 0 && planOtsN > 0 && integrationStatus === 'conectado') {
    const v = vacuumCopyForStableKey('documentos_vacio');
    vacios.push({
      stableKey: 'documentos_vacio',
      origen: 'Documentos',
      assignee: assigneeFromChannelId(v?.channel_id, 'NORMAL', 'Lyn'),
      channel_id: v?.channel_id,
      headline: v?.headline || 'Sin documentos técnicos en sistema',
      impacto: v?.impacto || 'Impacto: aprobación Lyn y trazabilidad limitadas.',
      accion: v?.accion || 'Acción: subir informes PDF en documentos técnicos.',
      prioridad: 'NORMAL',
      tiempoSinAccion: '—',
    });
  }

  let datosPct = 0;
  datosPct += planOtsN > 0 ? 22 : 4;
  datosPct += outlookN > 0 ? 18 : 0;
  datosPct += waN > 0 ? 10 : 0;
  datosPct += oppsN > 0 ? 16 : 0;
  datosPct += docsN > 0 ? 14 : 0;
  datosPct += calEntriesN > 0 ? 12 : 0;
  if (openOts.length && otsConVaciosEvidencia === 0) datosPct += 8;
  else datosPct += Math.max(0, 8 - otsConVaciosEvidencia * 2);
  datosPct = Math.min(100, Math.round(datosPct));

  const openN = openOts.length || 1;
  const conEconomia = openOts.filter(
    (o) => Number(String(o?.montoCobrado || '').replace(',', '.')) > 0
  ).length;
  const operacionPct = Math.min(100, Math.round((conEconomia / openN) * 70 + (openOts.length ? 30 : 5)));

  const decisionesPct = Math.min(100, Math.round(Math.min(12, boardN) * 7 + Math.min(8, alertsN) * 4));

  const saludHeadline = Math.round((datosPct + operacionPct + decisionesPct) / 3);
  const faltaResumen = vacios.length
    ? vacios
        .slice(0, 3)
        .map((v) => v.headline)
        .join(' · ')
    : 'Sin eventos operativos bloqueantes en esta pasada.';

  const cr = friction?.capaRealidad || {};
  const bloqueado = Number(cr.ingresoBloqueado) || 0;

  let dineroOtExpuesto = 0;
  for (const ot of openOts) {
    if (!getEvidenceGaps(ot).length) continue;
    const m = roundMoney(ot?.montoCobrado) || roundMoney(ot?.estimacionMonto) || roundMoney(ot?.monto);
    dineroOtExpuesto += m > 0 ? m : roundMoney(cr.ingresoProyectado) / Math.max(1, openOts.length);
  }
  const dineroRiesgoVivo = Math.round(bloqueado + dineroOtExpuesto);

  const eventosOperativos = vacios.map((v) => ({
    stableKey: v.stableKey || 'legacy',
    origen: v.origen || 'Sistema',
    descripcion: v.headline,
    impacto: String(v.impacto || '').replace(/^Impacto:\s*/i, '').trim(),
    accion: v.accion,
    tiempoSinAccion: v.tiempoSinAccion || '—',
    prioridad: v.prioridad,
    assignee: v.assignee || null,
    channel_id: v.channel_id || null,
    sinResponsable: !String(v.assignee || '').trim(),
  }));

  let estado = 'NORMAL';
  if (dataVacuum || alienDecision?.estadoGlobal === 'critico' || otsConVaciosEvidencia >= 3) {
    estado = 'CRITICO';
  } else if (alienDecision?.estadoGlobal === 'tension' || vacios.filter((v) => v.prioridad === 'CRITICO' || v.prioridad === 'ALTO').length >= 2) {
    estado = 'ALTO';
  }

  let instruccion = 'Mantener ingesta y revisar tablero de acciones.';
  let lineaPrincipal = `${saludoContextual()} Sistema estable. Flujo en observación.`;
  if (dataVacuum) {
    lineaPrincipal = 'Hernan, faltan datos críticos. El sistema no puede decidir con confianza.';
    instruccion = 'Cargá OT, correo, calendario u oportunidades antes de forzar decisiones.';
  } else if (estado === 'CRITICO') {
    lineaPrincipal = 'Hernan, detecto presión operativa. Acción requerida.';
    instruccion = 'Atender vacíos listados y cerrar dinero detenido hoy.';
  } else if (estado === 'ALTO') {
    lineaPrincipal = 'Hernan, hay tensión operativa: revisá vacíos y prioridades.';
    instruccion = 'Completar evidencias y pipeline antes del siguiente corte.';
  }

  const nucleus = {
    ultimaSenal:
      liveDigestFirst?.queEntro && liveDigestFirst?.significa
        ? `Última señal: ${String(liveDigestFirst.queEntro).slice(0, 80)} → ${String(liveDigestFirst.significa).slice(0, 80)}`
        : centroLast?.tipoSalida || centroLast?.canalSalida
          ? `Última ingesta centro: ${String(centroLast.tipoSalida || centroLast.canalSalida || 'dato')} · ${String(centroLast.excerpt || centroLast.rawExcerpt || '').slice(0, 100)}`
          : 'Última señal: sin ingesta reciente en centro — usar ingesta universal.',
    estadoNucleo: estado,
    decisionActiva: String(
      alienDecision?.focoDelDia || vacios[0]?.accion || 'Validar siguiente paso con dueño y fecha.'
    ).slice(0, 200),
  };

  const decide = {
    detectado:
      vacios[0]?.headline ||
      (bloqueado > 0 ? `Ingreso proyectado vs bloqueado en capa realidad.` : 'Sin anomalía única dominante.'),
    monto: bloqueado,
    montoLabel: bloqueado > 0 ? `$${fmtMoney(bloqueado)} bloqueados o en riesgo` : 'Sin monto bloqueado explícito en capa realidad',
    accion:
      bloqueado > 200000
        ? 'Acción: cerrar OT y cobrar hoy — desbloquear flujo de caja.'
        : vacios[0]?.accion || 'Acción: ejecutar primera acción del tablero ejecutar_hoy / cobrar_hoy.',
  };

  const byPri = (a, b) => {
    const o = (p) => (p === 'CRITICO' ? 0 : p === 'ALTO' ? 1 : 2);
    return o(a.prioridad) - o(b.prioridad);
  };
  const sortedEv = [...eventosOperativos].sort(byPri);
  const accionesActivas = {
    principal:
      sortedEv[0]?.accion ||
      decide.accion ||
      'Definir siguiente acción ejecutable en tablero ejecutar_hoy / cobrar_hoy.',
    secundarias: sortedEv.slice(1, 5).map((e) => e.accion).filter(Boolean),
  };

  const buckets = board?.buckets || {};
  const distribuye = [];

  const rolByQuien = {
    Romina: 'OT / evidencias',
    Gery: 'Comercial / clientes',
    Lyn: 'Administración',
    Hernan: 'Decisiones críticas',
  };

  const take = (key, quien, prefijo) => {
    const arr = buckets[key];
    if (!Array.isArray(arr) || !arr[0]) return;
    const a = arr[0];
    distribuye.push({
      quien,
      rol: rolByQuien[quien] || 'Operación',
      tarea: `${prefijo}: ${a.titulo || a.motivo || key}`.slice(0, 140),
      estado: 'Asignado · activo',
      tiempoActivo: 'En curso (tablero)',
    });
  };

  take('escalar_a_hernan', 'Hernan', 'Decisión crítica');
  take('escalar_a_lyn', 'Lyn', 'Revisión / pagos');
  take('cobrar_hoy', 'Romina', 'Seguimiento OT y cobro');
  take('ejecutar_hoy', 'Gery', 'Contacto cliente / ejecución');
  take('aprobar_hoy', 'Lyn', 'Revisión técnica');
  take('vender_hoy', 'Gery', 'Pipeline comercial');

  if (distribuye.length < 3) {
    const defaults = [
      { quien: 'Romina', tarea: 'Seguimiento OT y evidencias pendientes', estado: 'En cola' },
      { quien: 'Gery', tarea: 'Contacto cliente en frentes abiertos', estado: 'En cola' },
      { quien: 'Lyn', tarea: 'Revisión de pagos y aprobaciones', estado: 'En cola' },
      { quien: 'Hernan', tarea: 'Decisión crítica si escala presión', estado: 'Stand-by' },
    ];
    for (const d of defaults) {
      if (distribuye.length >= 4) break;
      if (!distribuye.some((x) => x.quien === d.quien))
        distribuye.push({
          ...d,
          rol: rolByQuien[d.quien] || 'Operación',
          tiempoActivo: 'En cola',
        });
    }
  }

  const ingestChannels = [
    { id: 'calendario', label: 'Calendario', ok: calEntriesN > 0, detalle: calEntriesN ? `${calEntriesN} entradas` : 'Sin datos' },
    { id: 'correos', label: 'Correos', ok: outlookN > 0, detalle: outlookN ? `${outlookN} en vista` : 'Sin entradas' },
    { id: 'whatsapp', label: 'WhatsApp', ok: waN > 0, detalle: waN ? `${waN} mensajes` : 'Sin entradas' },
    { id: 'ot', label: 'OT / evidencias', ok: planOtsN > 0 && otsConVaciosEvidencia === 0, detalle: `${planOtsN} OT · ${otsConVaciosEvidencia ? otsConVaciosEvidencia + ' con vacíos' : 'evidencias OK'}` },
    { id: 'oportunidades', label: 'Oportunidades', ok: oppsN > 0, detalle: oppsN ? `${oppsN} registros` : 'Sin pipeline' },
    { id: 'documentos', label: 'Documentos', ok: docsN > 0, detalle: docsN ? `${docsN} docs` : 'Sin docs' },
  ];

  const respuestaIngesta = buildRespuestaIngesta(centroLast);

  return {
    layerFlow: ['Ingreso', 'Detección', 'Núcleo', 'Distribución'],
    presencia: {
      lineaPrincipal,
      instruccion,
      estado,
      impactoVivo: bloqueado,
      impactoLabel: `$${fmtMoney(dineroRiesgoVivo)} en riesgo operativo (bloqueo + OT expuestas)`,
      completitudPct: datosPct,
      dineroRiesgoVivo,
    },
    vacios,
    eventosOperativos,
    accionesActivas,
    evidenceGapOldestMs,
    nucleus,
    decide,
    distribuye: distribuye.slice(0, 6),
    salud: {
      datosPct,
      operacionPct,
      decisionesPct,
      headlinePct: saludHeadline,
      falta: faltaResumen,
    },
    ingestChannels,
    respuestaIngesta,
  };
}

function buildRespuestaIngesta(centroLast) {
  if (!centroLast?.at) return null;
  const age = Date.now() - new Date(centroLast.at).getTime();
  if (age > 20 * 60 * 1000) return null;
  const area =
    centroLast.canalSalida ||
    centroLast.tipoSalida ||
    centroLast.kind ||
    'operación';
  const owner = centroLast.responsableSugerido || centroLast.responsable || 'definir dueño en tablero';
  return {
    lineas: [
      '1. Recibido — dato ingresado al buffer operativo.',
      '2. Interpretado — significado operativo extraído.',
      `3. Clasificado en: ${area}.`,
      centroLast.generaIngreso || centroLast.tipoSalida === 'oportunidad'
        ? '4. Impacto catalogado: oportunidad / ingreso potencial.'
        : '4. Impacto catalogado: continuidad operativa / soporte a decisión.',
      `5. Asignado (sugerido): ${owner}.`,
      '6. Acción definida — aparece en tablero / presión Jarvis.',
    ],
    cierre: 'Evento en seguimiento activo hasta cierre.',
  };
}
