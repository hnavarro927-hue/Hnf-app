/**
 * HNF Intelligence Engine — directora operativa (reglas + snapshot).
 * Sin LLM externo: auditable. Hook `runAIAnalysis` reservado para capa futura.
 *
 * Uso: getOperationalSnapshot(viewData) → detectOperationalIssues(snap, viewData?) → generateActionPlan(issues)
 */

import { otCanClose } from '../utils/ot-evidence.js';
import { collectFlowDirectorSummary } from './hnf-flow-control.js';
import {
  computeCommercialOpportunityAlerts,
  computeTechnicalDocumentAlerts,
  runJarvisDocumentReview,
  suggestAssetSignalsFromDocument,
} from './technical-document-intelligence.js';
import { tarifaBaseOperativa, utilidadOperativa } from './flota-solicitud-economics.js';

export const HNF_INTELLIGENCE_ENGINE_ID = 'hnf.intelligenceEngine';
export const HNF_INTELLIGENCE_VERSION = '2026-03-22';

const OT_ABIERTA_MAX_DIAS = 7;
const FLOTA_RUTA_SIN_AVANCE_HORAS = 48;
const MARGEN_UTILIDAD_ALERTA = 0.12;

const pad2 = (n) => String(n).padStart(2, '0');

export const monthRangeYmd = (d = new Date()) => {
  const start = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(last.getDate())}`;
  return { start, end };
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const addDaysYmd = (ymd, delta) => {
  const [y, m, dd] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, dd + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

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

const horasDesdeActualizacion = (s) => {
  const ref = s?.updatedAt || s?.createdAt || (s?.fecha ? `${String(s.fecha).slice(0, 10)}T12:00:00` : '');
  const t = parseTs(ref);
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 3600000;
};

const climaOtIngresoReal = (o) => roundMoney(o.montoCobrado);
const climaOtCosto = (o) => roundMoney(o.costoTotal);
const climaOtUtilidad = (o) => roundMoney(o.utilidad ?? climaOtIngresoReal(o) - climaOtCosto(o));

const flotaSolIngresoReal = (s) => {
  const tb = tarifaBaseOperativa(s);
  if (tb > 0 && s.estado === 'cerrada') return roundMoney(tb);
  const f = roundMoney(s.ingresoFinal);
  return f > 0 ? f : 0;
};

const flotaSolUtilidadReal = (s) => roundMoney(s.utilidad ?? utilidadOperativa(s));

const economicsPersistedOk = (ot) =>
  roundMoney(ot?.montoCobrado) > 0 && roundMoney(ot?.costoTotal) > 0;

/** Esquema de automatización futura (solo metadatos; no ejecuta). */
export const INTEL_AUTOMATION_SCHEMA = {
  kinds: ['suggested_status_change', 'closure_checklist', 'cobro_reminder', 'suggested_economics_completion'],
  version: '2026-03-22',
};

/** Textos cortos para banner de resolución guiada (sin lógica nueva). */
export const INTEL_GUIDANCE_TEXT = {
  CLIM_SIN_COSTO: {
    why: 'El motor marcó esta OT en terminado sin costo total en servidor.',
    fix: 'Completá y guardá costos y monto cobrado en la tarjeta económica.',
    unlock: 'Costo total y monto cobrado > 0 guardados en servidor.',
  },
  CLIM_SIN_COBRO: {
    why: 'Hay informe PDF pero el cobro registrado sigue en cero.',
    fix: 'Actualizá monto cobrado y guardá economía.',
    unlock: 'Monto cobrado > 0 persistido.',
  },
  CLIM_SIN_PDF: {
    why: 'OT terminada sin PDF de informe adjunto al registro.',
    fix: 'Generá el informe PDF desde el detalle y guardalo en la OT.',
    unlock: 'Campo informe/PDF con URL válida en servidor.',
  },
  CLIM_OT_VIEJA: {
    why: 'OT abierta más días de lo esperado por la regla operativa.',
    fix: 'Cerrá el circuito (evidencias, textos, economía) o actualizá el estado con criterio.',
    unlock: 'Estado coherente con el trabajo realizado y economía válida si aplica.',
  },
  FLO_SIN_INGRESO: {
    why: 'Solicitud cerrada sin costo operativo válido (combustible + peaje + externo).',
    fix: 'Registrá costos directos, observación de cierre, conductor y vehículo; guardá o corregí el cierre.',
    unlock: 'Costo operativo total > 0 en servidor.',
  },
  FLO_RUTA_STALE: {
    why: 'En ruta sin actualización reciente según umbral del motor.',
    fix: 'Registrá avance o cambiá estado para reflejar la realidad.',
    unlock: 'Actualización reciente o estado distinto de «en ruta» estancado.',
  },
  FLO_APROBADA: {
    why: 'Solicitud aprobada aún sin ejecutar en pipeline.',
    fix: 'Programá o avanzá el estado según operación.',
    unlock: 'Estado posterior a aprobada con datos listos.',
  },
  PLAN_MANT_ATRAS: {
    why: 'Mantención con fecha vencida y no realizada.',
    fix: 'Reprogramá o marcá realizado según corresponda.',
    unlock: 'Fecha futura o estado realizado alineado al trabajo.',
  },
  PLAN_SIN_CONT: {
    why: 'Tienda con mantención realizada y sin próxima fecha programada.',
    fix: 'Agendá una mantención futura para esa tienda.',
    unlock: 'Mantención pendiente o programada con fecha posterior a hoy.',
  },
  FIN_UTIL_NEG: {
    why: 'Utilidad del mes negativa con ingreso real > 0.',
    fix: 'Auditá costos y cobros en Clima y Flota del período.',
    unlock: 'Márgenes alineados al cierre de datos del mes.',
  },
  FIN_MARGEN_BAJO: {
    why: 'Margen del mes bajo el umbral configurado.',
    fix: 'Revisá OT y solicitudes con margen ajustado.',
    unlock: 'Revisión registrada o mejora en cobros/costos.',
  },
  FIN_CLIENTE: {
    why: 'Cliente con cobros o ingresos flota faltantes en el mes.',
    fix: 'Filtrá y completá datos por cliente en planificación y módulos.',
    unlock: 'Sin pendientes del mismo tipo para ese cliente en el mes.',
  },
  FILTER_SIN_COSTO: {
    why: 'Listado filtrado: terminadas sin costo total.',
    fix: 'Completá economía en cada fila visible.',
    unlock: 'Cada OT con costo y cobro guardados.',
  },
  FILTER_MES: {
    why: 'Listado acotado al mes calendario actual.',
    fix: 'Cerrá pendientes del mes en esta vista.',
    unlock: 'Datos del mes coherentes con operación.',
  },
  PLAN_ATRASADAS: {
    why: 'Vista filtrada a mantenciones atrasadas.',
    fix: 'Actualizá estado o fecha de cada ítem.',
    unlock: 'Sin atrasadas pendientes de resolución.',
  },
  PLAN_PROXIMAS: {
    why: 'Vista de mantenciones en ventana próxima.',
    fix: 'Confirmá técnico, fecha y estado.',
    unlock: 'Agenda revisada para la ventana.',
  },
  TODAY_OT_PEND: {
    why: 'OT pendiente con fecha a tratar hoy o próxima.',
    fix: 'Asigná visita o cambiá estado según avance.',
    unlock: 'Estado actualizado o fecha reprogramada.',
  },
  TODAY_OT_LISTO_CERRAR: {
    why: 'OT con economía y evidencias listas para cierre.',
    fix: 'Cerrá la OT e informe final desde el detalle.',
    unlock: 'Estado terminado con PDF en servidor.',
  },
};

/**
 * @param {object} nav
 * @param {string} codigo
 * @param {string} [recordLabel]
 */
export function attachGuidanceToIntelNav(nav, codigo, recordLabel = '') {
  if (!nav || typeof nav !== 'object') return nav;
  const t = INTEL_GUIDANCE_TEXT[codigo];
  if (!t) return nav;
  return {
    ...nav,
    guidance: {
      codigo,
      recordLabel: recordLabel || '',
      why: t.why,
      fix: t.fix,
      unlock: t.unlock,
    },
  };
}

/**
 * Snapshot operativo consolidado (contrato estable para ERP e IA futura).
 * @param {object} viewData - Misma forma que `state.viewData` en main (dashboard completo).
 */
export function getOperationalSnapshot(viewData) {
  const rawOts = viewData?.ots?.data ?? viewData?.ots ?? [];
  const ots = Array.isArray(rawOts) ? rawOts : [];
  const otsClima = ots.filter(isOtClima);
  const otMonthFlotaTipo = ots.filter((o) => !isOtClima(o));

  const flota = viewData?.flotaSolicitudes ?? [];
  const flotaList = Array.isArray(flota) ? flota : [];
  const planMantenciones = viewData?.planMantenciones ?? [];
  const mantList = Array.isArray(planMantenciones) ? planMantenciones : [];

  const today = todayYmd();
  const { start: monthStart, end: monthEnd } = monthRangeYmd();
  const otMonthClima = otsClima.filter((o) => o.fecha >= monthStart && o.fecha <= monthEnd);
  const flotaMonth = flotaList.filter((s) => s.fecha >= monthStart && s.fecha <= monthEnd);

  const climaIngresoRealMes = otMonthClima.reduce((t, o) => t + climaOtIngresoReal(o), 0);
  const climaCostoMes = otMonthClima.reduce((t, o) => t + climaOtCosto(o), 0);
  const climaUtilidadMes = otMonthClima.reduce((t, o) => t + climaOtUtilidad(o), 0);
  const flotaSolIngresoRealMes = flotaMonth.reduce((t, s) => t + flotaSolIngresoReal(s), 0);
  const flotaSolCostoMes = flotaMonth.reduce((t, s) => t + roundMoney(s.costoTotal), 0);
  const flotaSolUtilidadRealMes = flotaMonth.reduce((t, s) => t + flotaSolUtilidadReal(s), 0);
  const otFlotaTipoIngresoMes = otMonthFlotaTipo.reduce((t, o) => t + climaOtIngresoReal(o), 0);
  const otFlotaTipoCostoMes = otMonthFlotaTipo.reduce((t, o) => t + climaOtCosto(o), 0);
  const otFlotaTipoUtilidadMes = otMonthFlotaTipo.reduce((t, o) => t + climaOtUtilidad(o), 0);

  const ingresoRealMes =
    climaIngresoRealMes + flotaSolIngresoRealMes + otFlotaTipoIngresoMes;
  const costosMes = climaCostoMes + flotaSolCostoMes + otFlotaTipoCostoMes;
  const utilidadMes = climaUtilidadMes + flotaSolUtilidadRealMes + otFlotaTipoUtilidadMes;

  const pendientes = otsClima.filter((o) => o.estado === 'pendiente').length;
  const enProceso = otsClima.filter((o) => o.estado === 'en proceso').length;
  const terminadas = otsClima.filter((o) => o.estado === 'terminado').length;
  const sinCostos = otsClima.filter(
    (o) => o.estado === 'terminado' && (!Number(o.costoTotal) || roundMoney(o.costoTotal) <= 0)
  ).length;
  const sinPDF = otsClima.filter(
    (o) => o.estado === 'terminado' && (!o.pdfUrl || !String(o.pdfUrl).trim())
  ).length;
  const noCobradas = otsClima.filter(
    (o) =>
      o.estado === 'terminado' &&
      o.pdfUrl &&
      String(o.pdfUrl).trim().length > 0 &&
      roundMoney(o.montoCobrado) <= 0
  ).length;

  const solicitudes = flotaList.length;
  const enRuta = flotaList.filter((s) => s.estado === 'en_ruta').length;
  const completadas = flotaList.filter((s) => s.estado === 'completada').length;
  /** Completada operativa aún sin pasar a «cerrada» (administración). «en_ruta» no cuenta aquí. */
  const sinCerrar = flotaList.filter((s) => s.estado === 'completada').length;
  const sinIngresoFinal = flotaList.filter(
    (s) => s.estado === 'cerrada' && roundMoney(s.costoTotal) <= 0
  ).length;
  const pendientesFlota = flotaList.filter((s) =>
    ['recibida', 'evaluacion', 'cotizada', 'aprobada', 'programada'].includes(String(s.estado || ''))
  ).length;

  const prox7End = addDaysYmd(today, 7);
  const mantencionesProximas = mantList.filter(
    (m) =>
      m.fecha >= today &&
      m.fecha <= prox7End &&
      (m.estado === 'programado' || m.estado === 'pendiente')
  ).length;
  const atrasadas = mantList.filter((m) => m.fecha < today && m.estado !== 'realizado').length;

  const tiendasConRealizado = new Set(
    mantList.filter((m) => m.estado === 'realizado' && m.tiendaId).map((m) => m.tiendaId)
  );
  const tiendaTieneMantFutura = (tid) =>
    mantList.some(
      (m) =>
        m.tiendaId === tid &&
        String(m.fecha || '') > today &&
        (m.estado === 'pendiente' || m.estado === 'programado')
    );
  const sinContinuidad = [...tiendasConRealizado].filter((tid) => !tiendaTieneMantFutura(tid)).length;

  const wf = viewData?.whatsappFeed;
  const waMsgs = Array.isArray(wf?.messages) ? wf.messages : [];
  const waErr = Array.isArray(wf?.errors) ? wf.errors : [];
  const waCrit = waMsgs.filter((m) => m.impactoNivel === 'critico').length;
  const waAtt = waMsgs.filter((m) => m.impactoNivel === 'atencion').length;
  const waOk = waMsgs.filter((m) => m.impactoNivel === 'correcto').length;

  return {
    clima: {
      totalOT: otsClima.length,
      pendientes,
      enProceso,
      terminadas,
      sinCostos,
      sinPDF,
      noCobradas,
    },
    flota: {
      solicitudes,
      enRuta,
      completadas,
      sinCerrar,
      sinIngresoFinal,
      pendientes: pendientesFlota,
    },
    planificacion: {
      mantencionesProximas,
      atrasadas,
      sinContinuidad,
    },
    financiero: {
      ingresoRealMes: roundMoney(ingresoRealMes),
      costosMes: roundMoney(costosMes),
      utilidadMes: roundMoney(utilidadMes),
    },
    whatsapp: {
      mensajes: waMsgs.length,
      impactoCritico: waCrit,
      impactoAtencion: waAtt,
      impactoCorrecto: waOk,
      erroresFeed: waErr.length,
    },
  };
}

/**
 * @param {ReturnType<typeof getOperationalSnapshot>} snapshot
 * @param {object} [rawViewData] - Misma carga que dashboard; opcional pero recomendado para reglas con tiempo / clientes.
 */
export function detectOperationalIssues(snapshot, rawViewData = null) {
  /** @type {Array<{ tipo: string, modulo: string, mensaje: string, accion: string, code: string, count?: number, detalle?: string }>} */
  const issues = [];
  const push = (x) => issues.push(x);

  const c = snapshot.clima;
  const f = snapshot.flota;
  const p = snapshot.planificacion;
  const fin = snapshot.financiero;

  if (c.sinCostos > 0) {
    push({
      tipo: 'CRITICO',
      modulo: 'clima',
      code: 'CLIM_SIN_COSTO',
      mensaje: 'OT terminadas sin costos',
      accion: 'Completar costos en OT terminadas',
      count: c.sinCostos,
    });
  }
  if (c.noCobradas > 0) {
    push({
      tipo: 'CRITICO',
      modulo: 'clima',
      code: 'CLIM_SIN_COBRO',
      mensaje: 'OT informadas no cobradas',
      accion: 'Registrar cobros / facturación en OT con PDF',
      count: c.noCobradas,
    });
  }
  if (c.sinPDF > 0) {
    push({
      tipo: 'ATENCION',
      modulo: 'clima',
      code: 'CLIM_SIN_PDF',
      mensaje: 'OT terminadas sin informe PDF',
      accion: 'Generar y adjuntar informe PDF de cierre',
      count: c.sinPDF,
    });
  }

  if (f.sinIngresoFinal > 0) {
    push({
      tipo: 'CRITICO',
      modulo: 'flota',
      code: 'FLO_SIN_INGRESO',
      mensaje: 'Flota cerrada sin costos operativos válidos',
      accion: 'Registrar combustible, peaje y externo; observación de cierre y asignación real',
      count: f.sinIngresoFinal,
    });
  }
  if (f.sinCerrar > 0) {
    push({
      tipo: 'ATENCION',
      modulo: 'flota',
      code: 'FLO_SIN_CERRAR',
      mensaje: 'Flota en «completada» sin cierre administrativo (pasar a «cerrada»)',
      accion: 'Cerrar con costos operativos, observación de cierre, conductor y vehículo reales',
      count: f.sinCerrar,
    });
  }

  if (p.sinContinuidad > 0) {
    push({
      tipo: 'ATENCION',
      modulo: 'planificacion',
      code: 'PLAN_SIN_CONT',
      mensaje: 'Mantenciones sin continuidad (tienda sin próxima fecha)',
      accion: 'Programar mantenciones faltantes',
      count: p.sinContinuidad,
    });
  }
  if (p.atrasadas > 0) {
    push({
      tipo: 'ATENCION',
      modulo: 'planificacion',
      code: 'PLAN_ATRAS',
      mensaje: 'Mantenciones atrasadas',
      accion: 'Actualizar estado o reprogramar mantenciones vencidas',
      count: p.atrasadas,
    });
  }

  if (fin.utilidadMes < 0 && fin.ingresoRealMes > 0) {
    push({
      tipo: 'CRITICO',
      modulo: 'financiero',
      code: 'FIN_UTIL_NEG',
      mensaje: 'Utilidad mensual consolidada negativa con ingreso registrado',
      accion: 'Auditar costos y cobros del mes',
      count: 1,
    });
  } else if (fin.ingresoRealMes > 0) {
    const ratio = fin.utilidadMes / fin.ingresoRealMes;
    if (Number.isFinite(ratio) && ratio < MARGEN_UTILIDAD_ALERTA) {
      push({
        tipo: 'ATENCION',
        modulo: 'financiero',
        code: 'FIN_MARGEN_BAJO',
        mensaje: 'Utilidad del mes baja respecto al ingreso real',
        accion: 'Revisar costos, precios y OT / flota con margen negativo',
        count: 1,
      });
    }
  }

  const wa = snapshot.whatsapp;
  if (wa && wa.impactoCritico > 0) {
    push({
      tipo: 'CRITICO',
      modulo: 'whatsapp',
      code: 'WA_IMPACTO_CRITICO',
      mensaje: 'Ingesta WhatsApp con impacto crítico (identidad, evidencia o cierre incompleto)',
      accion: 'Abrir consola WhatsApp y resolver OT o datos faltantes',
      count: wa.impactoCritico,
    });
  }
  if (wa && wa.erroresFeed > 0) {
    push({
      tipo: 'ATENCION',
      modulo: 'whatsapp',
      code: 'WA_FEED_ERRORS',
      mensaje: 'Alertas registradas en whatsapp_feed.errors',
      accion: 'Revisar feed de errores y corregir en ERP',
      count: wa.erroresFeed,
    });
  }

  if (rawViewData) {
    const rawOts = rawViewData?.ots?.data ?? rawViewData?.ots ?? [];
    const ots = Array.isArray(rawOts) ? rawOts : [];
    const otsClima = ots.filter(isOtClima);

    let staleOt = 0;
    const muestraCliente = new Set();
    for (const o of otsClima) {
      if (o.estado === 'terminado') continue;
      const base = o.creadoEn || o.createdAt || o.fecha;
      const d = diasDesde(base);
      if (d != null && d > OT_ABIERTA_MAX_DIAS) {
        staleOt += 1;
        if (muestraCliente.size < 4 && o.cliente) muestraCliente.add(String(o.cliente).trim());
      }
    }
    if (staleOt > 0) {
      const extra = [...muestraCliente].filter(Boolean).slice(0, 2).join(', ');
      push({
        tipo: 'ATENCION',
        modulo: 'clima',
        code: 'CLIM_OT_VIEJA',
        mensaje: `OT abiertas hace más de ${OT_ABIERTA_MAX_DIAS} días`,
        accion: extra ? `Priorizar cierre o avance (${extra})` : 'Priorizar cierre o avance de OT antiguas',
        count: staleOt,
        detalle: extra || undefined,
      });
    }

    const flotaList = Array.isArray(rawViewData.flotaSolicitudes) ? rawViewData.flotaSolicitudes : [];
    let rutaSinAvance = 0;
    for (const s of flotaList) {
      if (s.estado !== 'en_ruta') continue;
      const h = horasDesdeActualizacion(s);
      if (h > FLOTA_RUTA_SIN_AVANCE_HORAS) rutaSinAvance += 1;
    }
    if (rutaSinAvance > 0) {
      push({
        tipo: 'ATENCION',
        modulo: 'flota',
        code: 'FLO_RUTA_STALE',
        mensaje: 'Flota en ruta sin avance reciente',
        accion: 'Verificar estado en terreno y actualizar solicitud',
        count: rutaSinAvance,
      });
    }

    const flotaAprobada = flotaList.filter((s) => s.estado === 'aprobada').length;
    if (flotaAprobada > 0) {
      push({
        tipo: 'ATENCION',
        modulo: 'flota',
        code: 'FLO_APROBADA',
        mensaje: 'Solicitudes aprobadas sin ejecutar',
        accion: 'Programar o avanzar pipeline de flota',
        count: flotaAprobada,
      });
    }

    const clienteNorm = (n) => String(n || '').trim() || '—';
    const monthStart = monthRangeYmd().start;
    const monthEnd = monthRangeYmd().end;
    const otMonthClima = otsClima.filter((o) => o.fecha >= monthStart && o.fecha <= monthEnd);
    const flotaMonth = flotaList.filter((s) => s.fecha >= monthStart && s.fecha <= monthEnd);
    const agg = new Map();
    const bump = (name, key, n = 1) => {
      const k = clienteNorm(name);
      if (!agg.has(k)) agg.set(k, { sinCobroTerm: 0, sinIngresoCerrada: 0 });
      const o = agg.get(k);
      o[key] += n;
    };
    for (const o of otMonthClima) {
      if (o.estado === 'terminado' && roundMoney(o.montoCobrado) <= 0) bump(o.cliente, 'sinCobroTerm');
    }
    for (const s of flotaMonth) {
      if (s.estado === 'cerrada' && roundMoney(s.costoTotal) <= 0) bump(s.cliente, 'sinIngresoCerrada');
    }
    const problemClients = [...agg.entries()].filter(
      ([, v]) => v.sinCobroTerm > 0 || v.sinIngresoCerrada > 0
    );
    const names = problemClients.map(([n]) => n).filter((n) => n && n !== '—');
    if (names.length) {
      const head = names.slice(0, 4);
      push({
        tipo: 'ATENCION',
        modulo: 'financiero',
        code: 'FIN_CLIENTE',
        mensaje: `Clientes con cobros o ingresos pendientes (${names.length})`,
        accion: `Revisar facturación: ${head.join(', ')}${names.length > head.length ? '…' : ''}`,
        count: names.length,
        detalle: names.join(' · '),
      });
    }

    const opAlerts = Array.isArray(rawViewData.operationalCalendarAlerts)
      ? rawViewData.operationalCalendarAlerts
      : [];
    if (opAlerts.length) {
      const byCode = new Map();
      for (const a of opAlerts) {
        const code = String(a.code || 'OPCAL');
        if (!byCode.has(code)) {
          byCode.set(code, {
            code,
            severity: String(a.severity || 'warning'),
            count: 0,
            mensaje: a.mensaje || code,
            detalle: a.detalle,
          });
        }
        const g = byCode.get(code);
        g.count += 1;
      }
      for (const g of byCode.values()) {
        const tipo = g.severity === 'critical' ? 'CRITICO' : 'ATENCION';
        push({
          tipo,
          modulo: 'planificacion',
          code: g.code,
          mensaje: g.mensaje,
          accion: 'Abrir Planificación → Calendario operativo',
          count: g.count,
          detalle: g.detalle,
        });
      }
    }

    const docList = Array.isArray(rawViewData.technicalDocuments) ? rawViewData.technicalDocuments : [];
    const docAlerts =
      Array.isArray(rawViewData.technicalDocumentAlerts) && rawViewData.technicalDocumentAlerts.length
        ? rawViewData.technicalDocumentAlerts
        : computeTechnicalDocumentAlerts(
            docList,
            rawViewData?.ots?.data ?? rawViewData?.ots ?? []
          );
    if (docAlerts.length) {
      const byCode = new Map();
      for (const a of docAlerts) {
        const code = String(a.code || 'DOC');
        if (!byCode.has(code)) {
          byCode.set(code, {
            code,
            severity: String(a.severity || 'warning'),
            count: 0,
            mensaje: a.mensaje || code,
            detalle: a.detalle,
          });
        }
        byCode.get(code).count += 1;
      }
      for (const g of byCode.values()) {
        const tipo = g.severity === 'critical' ? 'CRITICO' : 'ATENCION';
        push({
          tipo,
          modulo: 'clima',
          code: g.code,
          mensaje: g.mensaje,
          accion: 'Abrir Documentos técnicos',
          count: g.count,
          detalle: g.detalle,
        });
      }
    }

    const coList = Array.isArray(rawViewData.commercialOpportunities) ? rawViewData.commercialOpportunities : [];
    const coAlerts =
      Array.isArray(rawViewData.commercialOpportunityAlerts) && rawViewData.commercialOpportunityAlerts.length
        ? rawViewData.commercialOpportunityAlerts
        : computeCommercialOpportunityAlerts(coList);
    if (coAlerts.length) {
      const byCo = new Map();
      for (const a of coAlerts) {
        const code = String(a.code || 'OP');
        if (!byCo.has(code)) {
          byCo.set(code, {
            code,
            severity: String(a.severity || 'warning'),
            count: 0,
            mensaje: a.mensaje || code,
            detalle: a.detalle,
          });
        }
        byCo.get(code).count += 1;
      }
      for (const g of byCo.values()) {
        const tipo = g.severity === 'critical' ? 'CRITICO' : g.severity === 'info' ? 'INFO' : 'ATENCION';
        push({
          tipo,
          modulo: 'comercial',
          code: g.code,
          mensaje: g.mensaje,
          accion: 'Abrir Oportunidades comerciales',
          count: g.count,
          detalle: g.detalle,
        });
      }
    }
  }

  const order = { CRITICO: 0, ATENCION: 1, INFO: 2 };
  issues.sort((a, b) => order[a.tipo] - order[b.tipo]);
  return issues;
}

/**
 * @param {ReturnType<typeof detectOperationalIssues>} issues
 * @returns {string[]}
 */
export function generateActionPlan(issues) {
  const lines = [];
  const seen = new Set();
  for (const i of issues) {
    if (i.tipo === 'INFO') continue;
    if (seen.has(i.code)) continue;
    seen.add(i.code);
    const n = i.count != null && i.count > 1 ? ` (${i.count})` : '';
    lines.push(`${i.accion}${n}`);
  }
  if (!lines.length) {
    lines.push('Mantener sincronización periódica y revisar módulos Clima, Flota y Planificación.');
  }
  return lines.slice(0, 14);
}

/**
 * Señales proactivas cortas (dashboard / banners).
 */
export function getProactiveSignals(snapshot) {
  const s = [];
  const abi = snapshot.clima.pendientes + snapshot.clima.enProceso;
  if (abi > 0) {
    s.push(`Tenés ${abi} OT de Clima sin cerrar (pendientes + en proceso).`);
  }
  if (snapshot.flota.sinIngresoFinal > 0) {
    s.push('Hay flota cerrada sin ingreso final registrado.');
  }
  if (snapshot.financiero.ingresoRealMes > 0) {
    const r = snapshot.financiero.utilidadMes / snapshot.financiero.ingresoRealMes;
    if (Number.isFinite(r) && r < MARGEN_UTILIDAD_ALERTA) {
      s.push('La utilidad del mes es baja frente al ingreso real consolidado.');
    }
  }
  if (snapshot.planificacion.atrasadas > 0) {
    s.push(`${snapshot.planificacion.atrasadas} mantención(es) atrasada(s) en el calendario.`);
  }
  return s.slice(0, 6);
}

/**
 * Estado agregado para UI: Óptimo | Atención | Crítico
 */
export function getOperationalHealthState(issues) {
  if (issues.some((i) => i.tipo === 'CRITICO')) return 'critico';
  if (issues.some((i) => i.tipo === 'ATENCION')) return 'atencion';
  return 'optimo';
}

const prioOrder = { CRITICO: 0, ATENCION: 1, SEGUIMIENTO: 2 };

/**
 * Cola ejecutable: ítems con navegación y hooks de automatización (sin ejecutar).
 * @returns {Array<{
 *   tipo: string, codigo: string, modulo: string, titulo: string, descripcion: string, accionCorta: string,
 *   refKey: string, nav: object, automation?: { kind: string, payload: object }
 * }>}
 */
export function buildIntelExecutionQueue(rawViewData) {
  const rawOts = rawViewData?.ots?.data ?? rawViewData?.ots ?? [];
  const ots = Array.isArray(rawOts) ? rawOts : [];
  const otsClima = ots.filter(isOtClima);
  const flotaList = Array.isArray(rawViewData?.flotaSolicitudes) ? rawViewData.flotaSolicitudes : [];
  const mantList = Array.isArray(rawViewData?.planMantenciones) ? rawViewData.planMantenciones : [];
  const today = todayYmd();

  const q = [];
  const seen = new Set();
  const add = (item) => {
    const k = item.refKey || `${item.codigo}:${item.titulo}`;
    const uk = `${item.codigo}:${k}`;
    if (seen.has(uk)) return;
    seen.add(uk);
    q.push(item);
  };

  for (const o of otsClima) {
    if (o.estado !== 'terminado') continue;
    if (roundMoney(o.costoTotal) > 0) continue;
    add({
      tipo: 'CRITICO',
      codigo: 'CLIM_SIN_COSTO',
      modulo: 'clima',
      titulo: `${o.id} · sin costos`,
      descripcion: o.cliente || '—',
      accionCorta: 'Abrir OT',
      refKey: o.id,
      nav: { view: 'clima', otId: o.id },
      automation: { kind: 'suggested_economics_completion', payload: { otId: o.id } },
    });
  }

  for (const o of otsClima) {
    if (o.estado !== 'terminado') continue;
    if (!o.pdfUrl || !String(o.pdfUrl).trim()) continue;
    if (roundMoney(o.montoCobrado) > 0) continue;
    add({
      tipo: 'CRITICO',
      codigo: 'CLIM_SIN_COBRO',
      modulo: 'clima',
      titulo: `${o.id} · informada sin cobro`,
      descripcion: o.cliente || '—',
      accionCorta: 'Registrar cobro',
      refKey: o.id,
      nav: { view: 'clima', otId: o.id },
      automation: { kind: 'cobro_reminder', payload: { otId: o.id } },
    });
  }

  for (const o of otsClima) {
    if (o.estado !== 'terminado') continue;
    if (o.pdfUrl && String(o.pdfUrl).trim()) continue;
    add({
      tipo: 'ATENCION',
      codigo: 'CLIM_SIN_PDF',
      modulo: 'clima',
      titulo: `${o.id} · sin PDF de cierre`,
      descripcion: o.cliente || '—',
      accionCorta: 'Generar informe',
      refKey: o.id,
      nav: { view: 'clima', otId: o.id },
      automation: { kind: 'closure_checklist', payload: { otId: o.id, step: 'pdf' } },
    });
  }

  for (const o of otsClima) {
    if (o.estado === 'terminado') continue;
    const base = o.creadoEn || o.createdAt || o.fecha;
    const d = diasDesde(base);
    if (d == null || d <= OT_ABIERTA_MAX_DIAS) continue;
    add({
      tipo: 'ATENCION',
      codigo: 'CLIM_OT_VIEJA',
      modulo: 'clima',
      titulo: `${o.id} · abierta ${d} días`,
      descripcion: o.cliente || '—',
      accionCorta: 'Avanzar / cerrar',
      refKey: o.id,
      nav: { view: 'clima', otId: o.id },
      automation: { kind: 'suggested_status_change', payload: { otId: o.id, hint: 'revisar_cierre' } },
    });
  }

  for (const s of flotaList) {
    if (s.estado !== 'cerrada') continue;
    if (roundMoney(s.costoTotal) > 0) continue;
    add({
      tipo: 'CRITICO',
      codigo: 'FLO_SIN_INGRESO',
      modulo: 'flota',
      titulo: `${s.id} · cerrada sin costos operativos`,
      descripcion: s.cliente || '—',
      accionCorta: 'Abrir solicitud',
      refKey: s.id,
      nav: { view: 'flota', flotaId: s.id },
      automation: { kind: 'suggested_economics_completion', payload: { flotaId: s.id } },
    });
  }

  for (const s of flotaList) {
    if (s.estado !== 'en_ruta') continue;
    if (horasDesdeActualizacion(s) <= FLOTA_RUTA_SIN_AVANCE_HORAS) continue;
    add({
      tipo: 'ATENCION',
      codigo: 'FLO_RUTA_STALE',
      modulo: 'flota',
      titulo: `${s.id} · en ruta sin actualizar`,
      descripcion: s.cliente || '—',
      accionCorta: 'Actualizar estado',
      refKey: s.id,
      nav: { view: 'flota', flotaId: s.id },
      automation: { kind: 'suggested_status_change', payload: { flotaId: s.id } },
    });
  }

  for (const s of flotaList.filter((x) => x.estado === 'aprobada').slice(0, 8)) {
    add({
      tipo: 'ATENCION',
      codigo: 'FLO_APROBADA',
      modulo: 'flota',
      titulo: `${s.id} · aprobada sin ejecutar`,
      descripcion: s.cliente || '—',
      accionCorta: 'Programar',
      refKey: s.id,
      nav: { view: 'flota', flotaId: s.id, flotaFilter: { estado: 'aprobada' } },
      automation: { kind: 'suggested_status_change', payload: { flotaId: s.id, next: 'programada' } },
    });
  }

  const mantAtrasadasSorted = mantList
    .filter((m) => m.fecha < today && m.estado !== 'realizado')
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  for (const m of mantAtrasadasSorted.slice(0, 8)) {
    add({
      tipo: 'ATENCION',
      codigo: 'PLAN_MANT_ATRAS',
      modulo: 'planificacion',
      titulo: `${m.id || 'Mant.'} · atrasada (${m.fecha})`,
      descripcion: m.tiendaId || '—',
      accionCorta: 'Planificación',
      refKey: m.id || `${m.tiendaId}-${m.fecha}`,
      nav: {
        view: 'planificacion',
        plan: { tab: 'plan', mantFilter: 'atrasadas', focusTiendaId: m.tiendaId, weekContainingDate: m.fecha },
      },
      automation: { kind: 'suggested_status_change', payload: { mantencionId: m.id } },
    });
  }

  const tiendasConRealizado = new Set(
    mantList.filter((m) => m.estado === 'realizado' && m.tiendaId).map((m) => m.tiendaId)
  );
  const tiendaTieneMantFutura = (tid) =>
    mantList.some(
      (m) =>
        m.tiendaId === tid &&
        String(m.fecha || '') > today &&
        (m.estado === 'pendiente' || m.estado === 'programado')
    );
  let sinContCount = 0;
  for (const tid of tiendasConRealizado) {
    if (sinContCount >= 10) break;
    if (tiendaTieneMantFutura(tid)) continue;
    sinContCount += 1;
    add({
      tipo: 'SEGUIMIENTO',
      codigo: 'PLAN_SIN_CONT',
      modulo: 'planificacion',
      titulo: `Tienda ${tid} · sin continuidad`,
      descripcion: 'Programar próxima mantención',
      accionCorta: 'Abrir plan',
      refKey: tid,
      nav: { view: 'planificacion', plan: { tab: 'plan', focusTiendaId: tid } },
      automation: { kind: 'closure_checklist', payload: { tiendaId: tid, kind: 'schedule_next' } },
    });
  }

  const ocAlertsExec = Array.isArray(rawViewData?.operationalCalendarAlerts)
    ? rawViewData.operationalCalendarAlerts
    : [];
  const ocByCode = new Map();
  for (const a of ocAlertsExec) {
    const c = String(a.code || 'OPCAL');
    if (!ocByCode.has(c)) {
      ocByCode.set(c, {
        code: c,
        severity: String(a.severity || 'warning'),
        count: 0,
        mensaje: a.mensaje || c,
      });
    }
    ocByCode.get(c).count += 1;
  }
  for (const g of ocByCode.values()) {
    const tipo = g.severity === 'critical' ? 'CRITICO' : 'ATENCION';
    add({
      tipo,
      codigo: g.code,
      modulo: 'planificacion',
      titulo: `${g.code} · ${g.count} señal(es)`,
      descripcion: g.mensaje,
      accionCorta: 'Calendario operativo',
      refKey: g.code,
      nav: { view: 'planificacion', plan: { tab: 'operativo' } },
    });
  }

  const docListExec = Array.isArray(rawViewData?.technicalDocuments) ? rawViewData.technicalDocuments : [];
  const docAlertsExec =
    Array.isArray(rawViewData?.technicalDocumentAlerts) && rawViewData.technicalDocumentAlerts.length
      ? rawViewData.technicalDocumentAlerts
      : computeTechnicalDocumentAlerts(docListExec, otsClima);
  const docByCode = new Map();
  for (const a of docAlertsExec) {
    const c = String(a.code || 'DOC');
    if (!docByCode.has(c)) {
      docByCode.set(c, {
        code: c,
        severity: String(a.severity || 'warning'),
        count: 0,
        mensaje: a.mensaje || c,
      });
    }
    docByCode.get(c).count += 1;
  }
  for (const g of docByCode.values()) {
    const tipo = g.severity === 'critical' ? 'CRITICO' : 'ATENCION';
    add({
      tipo,
      codigo: g.code,
      modulo: 'clima',
      titulo: `${g.code} · ${g.count} señal(es)`,
      descripcion: g.mensaje,
      accionCorta: 'Documentos técnicos',
      refKey: g.code,
      nav: { view: 'technical-documents' },
    });
  }

  const coListExec = Array.isArray(rawViewData?.commercialOpportunities) ? rawViewData.commercialOpportunities : [];
  const coAlertsExec =
    Array.isArray(rawViewData?.commercialOpportunityAlerts) && rawViewData.commercialOpportunityAlerts.length
      ? rawViewData.commercialOpportunityAlerts
      : computeCommercialOpportunityAlerts(coListExec);
  const coByCode = new Map();
  for (const a of coAlertsExec) {
    const c = String(a.code || 'OP');
    if (!coByCode.has(c)) {
      coByCode.set(c, {
        code: c,
        severity: String(a.severity || 'warning'),
        count: 0,
        mensaje: a.mensaje || c,
      });
    }
    coByCode.get(c).count += 1;
  }
  for (const g of coByCode.values()) {
    const tipo = g.severity === 'critical' ? 'CRITICO' : g.severity === 'info' ? 'SEGUIMIENTO' : 'ATENCION';
    add({
      tipo,
      codigo: g.code,
      modulo: 'comercial',
      titulo: `${g.code} · ${g.count} señal(es)`,
      descripcion: g.mensaje,
      accionCorta: 'Oportunidades',
      refKey: g.code,
      nav: { view: 'oportunidades' },
    });
  }

  const snap = getOperationalSnapshot(rawViewData);
  const fin = snap.financiero;
  if (fin.utilidadMes < 0 && fin.ingresoRealMes > 0) {
    add({
      tipo: 'CRITICO',
      codigo: 'FIN_UTIL_NEG',
      modulo: 'financiero',
      titulo: 'Utilidad mensual negativa',
      descripcion: `Ingreso ${fin.ingresoRealMes} · revisar costos`,
      accionCorta: 'Auditar en Clima/Flota',
      refKey: 'fin-util-neg',
      nav: { view: 'clima', climaFilter: { soloMesActual: true } },
      automation: { kind: 'cobro_reminder', payload: { scope: 'month_audit' } },
    });
  } else if (fin.ingresoRealMes > 0) {
    const ratio = fin.utilidadMes / fin.ingresoRealMes;
    if (Number.isFinite(ratio) && ratio < MARGEN_UTILIDAD_ALERTA) {
      add({
        tipo: 'ATENCION',
        codigo: 'FIN_MARGEN_BAJO',
        modulo: 'financiero',
        titulo: 'Margen del mes bajo',
        descripcion: `${(ratio * 100).toFixed(1)}% sobre ingreso real`,
        accionCorta: 'Revisar márgenes',
        refKey: 'fin-margen',
        nav: { view: 'jarvis' },
        automation: { kind: 'cobro_reminder', payload: { scope: 'margin_review' } },
      });
    }
  }

  const names = [];
  const monthStart = monthRangeYmd().start;
  const monthEnd = monthRangeYmd().end;
  const otMonthClima = otsClima.filter((o) => o.fecha >= monthStart && o.fecha <= monthEnd);
  const flotaMonth = flotaList.filter((s) => s.fecha >= monthStart && s.fecha <= monthEnd);
  const agg = new Map();
  const bump = (name, key) => {
    const k = String(name || '').trim() || '—';
    if (!agg.has(k)) agg.set(k, { sinCobroTerm: 0, sinIngresoCerrada: 0 });
    agg.get(k)[key] += 1;
  };
  for (const o of otMonthClima) {
    if (o.estado === 'terminado' && roundMoney(o.montoCobrado) <= 0) bump(o.cliente, 'sinCobroTerm');
  }
  for (const s of flotaMonth) {
    if (s.estado === 'cerrada' && roundMoney(s.costoTotal) <= 0) bump(s.cliente, 'sinIngresoCerrada');
  }
  for (const [nombre, v] of agg) {
    if (nombre === '—') continue;
    if (!v.sinCobroTerm && !v.sinIngresoCerrada) continue;
    names.push({ nombre, v });
  }
  names.slice(0, 4).forEach(({ nombre, v }) => {
    const parts = [];
    if (v.sinCobroTerm) parts.push(`${v.sinCobroTerm} OT sin cobro`);
    if (v.sinIngresoCerrada) parts.push(`${v.sinIngresoCerrada} flota sin costo operativo`);
    add({
      tipo: 'ATENCION',
      codigo: 'FIN_CLIENTE',
      modulo: 'financiero',
      titulo: `${nombre} · ${parts.join(' · ')}`,
      descripcion: 'Facturación / ingresos del mes',
      accionCorta: 'Filtrar planificación',
      refKey: nombre,
      nav: {
        view: 'planificacion',
        plan: { tab: 'plan', focusClienteNombre: nombre },
      },
      automation: { kind: 'cobro_reminder', payload: { cliente: nombre } },
    });
  });

  q.sort((a, b) => prioOrder[a.tipo] - prioOrder[b.tipo]);
  return q.slice(0, 28).map((item) => ({
    ...item,
    nav: attachGuidanceToIntelNav(item.nav, item.codigo, item.refKey),
  }));
}

/**
 * Panel «Qué hacer hoy»: prioridades y tops (sin duplicar la cola completa).
 */
export function buildTodayOperationsPanel(rawViewData) {
  const queue = buildIntelExecutionQueue(rawViewData);
  const rawOts = rawViewData?.ots?.data ?? rawViewData?.ots ?? [];
  const ots = Array.isArray(rawOts) ? rawOts : [];
  const otsClima = ots.filter(isOtClima);
  const today = todayYmd();

  const prioridades = queue.filter((i) => i.tipo === 'CRITICO').slice(0, 6);

  const topPendientes = otsClima
    .filter((o) => o.estado === 'pendiente')
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .slice(0, 5)
    .map((o) => ({
      tipo: 'ATENCION',
      titulo: `${o.id} · pendiente`,
      descripcion: o.fecha === today ? 'Fecha hoy' : `Fecha ${o.fecha}`,
      nav: attachGuidanceToIntelNav({ view: 'clima', otId: o.id }, 'TODAY_OT_PEND', o.id),
    }));

  const topCierres = otsClima
    .filter((o) => o.estado !== 'terminado' && economicsPersistedOk(o) && otCanClose(o))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .slice(0, 5)
    .map((o) => ({
      tipo: 'CRITICO',
      titulo: `${o.id} · lista para cerrar`,
      descripcion: o.cliente || '—',
      nav: attachGuidanceToIntelNav({ view: 'clima', otId: o.id }, 'TODAY_OT_LISTO_CERRAR', o.id),
      automation: { kind: 'closure_checklist', payload: { otId: o.id, ready: true } },
    }));

  const topRiesgos = queue.filter((i) => i.tipo === 'ATENCION').slice(0, 5);

  const seguimiento = queue.filter((i) => i.tipo === 'SEGUIMIENTO').slice(0, 5);

  return { prioridades, topPendientes, topCierres, topRiesgos, seguimiento };
}

/**
 * Jarvis — análisis extendido de un documento técnico (incoherencias, riesgos, oportunidades, activos).
 * @param {object} documento - Fila de technical_documents (API).
 * @param {object|null} ot - OT Clima vinculada si existe.
 */
export function analyzeTechnicalDocument(documento, ot = null) {
  const d = documento || {};
  const jarvis = runJarvisDocumentReview(d, ot);
  const activos = suggestAssetSignalsFromDocument(d);
  const alertasIngesta = Array.isArray(d.alertasIngesta) ? d.alertasIngesta : [];

  const incoherencias = [];
  if (jarvis.consistenciaConOT && !['alineado', 'sin_ot'].includes(jarvis.consistenciaConOT)) {
    incoherencias.push({ tipo: 'documento_ot', texto: String(jarvis.consistenciaConOT) });
  }
  for (const a of alertasIngesta) {
    if (String(a.nivel || '').toLowerCase() === 'redaccion') {
      incoherencias.push({ tipo: 'ingesta_redaccion', texto: a.mensaje || a.code || '' });
    }
  }

  const critIngest = alertasIngesta
    .filter((x) => String(x.nivel || '').toLowerCase() === 'critico')
    .map((x) => x.mensaje || x.code)
    .filter(Boolean);
  const riesgosOcultos = [...new Set([...critIngest, ...jarvis.riesgosTecnicos])];

  return {
    engine: HNF_INTELLIGENCE_ENGINE_ID,
    version: HNF_INTELLIGENCE_VERSION,
    jarvis,
    incoherencias,
    riesgosOcultos,
    oportunidadesComerciales: activos.oportunidadesComerciales || [],
    activosCriticos: activos,
  };
}

/**
 * Hook reservado: mismo snapshot servirá para prompts / API generativa.
 * @param {ReturnType<typeof getOperationalSnapshot>} snapshot
 */
export async function runAIAnalysis(snapshot) {
  return {
    engine: HNF_INTELLIGENCE_ENGINE_ID,
    version: HNF_INTELLIGENCE_VERSION,
    mode: 'deterministic-placeholder',
    externalModel: null,
    at: new Date().toISOString(),
    inputSummary: {
      climaOT: snapshot?.clima?.totalOT ?? 0,
      flotaSolicitudes: snapshot?.flota?.solicitudes ?? 0,
      ingresoMes: snapshot?.financiero?.ingresoRealMes ?? 0,
    },
    note: 'Conectar aquí proveedor LLM o job backend; el contrato de snapshot es estable.',
  };
}

/**
 * Brief directivo: snapshot Intel + cola ejecutable + HNF Flow Control (eventos, riesgo, decisiones).
 * Reutiliza `getOperationalSnapshot` y `detectOperationalIssues`; el flujo enriquece sin duplicar reglas.
 * @param {object} viewData - Misma forma que carga unificada (main.js).
 */
export function getDirectorOperationalBrief(viewData) {
  const snapshot = getOperationalSnapshot(viewData);
  const issues = detectOperationalIssues(snapshot, viewData);
  const executionQueue = buildIntelExecutionQueue(viewData);
  const flow = collectFlowDirectorSummary(viewData, snapshot, issues, executionQueue);
  return { snapshot, issues, executionQueue, flow };
}
