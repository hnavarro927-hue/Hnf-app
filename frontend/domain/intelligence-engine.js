/**
 * Motor de análisis operativo HNF — reglas sobre datos reales del panel.
 * Sin LLM externo: respuestas auditable y deterministas.
 * Evolución: conectar capa generativa consumiendo el mismo snapshot + diagnostics.
 */

import { flotaNextEstado, FLOTA_ESTADO_LABELS } from '../constants/flotaPipeline.js';
import { buildFlotaOperationalBrief, buildOtOperationalBrief } from './operational-intelligence.js';
import { otCanClose } from '../utils/ot-evidence.js';
import { loadBusinessMemory } from './business-memory.js';
import { intelligenceLog } from '../utils/intelligence-logger.js';

export const INTELLIGENCE_ENGINE_SCHEMA = 'hnf.intelligenceEngine';
export const INTELLIGENCE_ENGINE_VERSION = '2025-03-23';

const pad2 = (n) => String(n).padStart(2, '0');
export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const economicsPersistedOk = (ot) => {
  const mc = roundMoney(ot?.montoCobrado);
  const ct = roundMoney(ot?.costoTotal);
  return mc > 0 && ct > 0;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

const daysBetweenYmd = (a, b) => {
  if (!a || !b) return null;
  const [y1, m1, d1] = String(a).split('-').map(Number);
  const [y2, m2, d2] = String(b).split('-').map(Number);
  const t1 = new Date(y1, m1 - 1, d1).getTime();
  const t2 = new Date(y2, m2 - 1, d2).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  return Math.round((t2 - t1) / 86400000);
};

/**
 * Normaliza la carga tipo dashboard para análisis cruzado.
 */
export function buildIntelligenceSnapshot(viewData) {
  const ots = viewData?.ots?.data ?? viewData?.ots ?? [];
  const otsList = Array.isArray(ots) ? ots : [];
  const flota = viewData?.flotaSolicitudes ?? [];
  const flotaList = Array.isArray(flota) ? flota : [];
  const planMantenciones = viewData?.planMantenciones ?? [];
  const mantList = Array.isArray(planMantenciones) ? planMantenciones : [];
  const health = viewData?.health ?? null;

  return {
    schema: INTELLIGENCE_ENGINE_SCHEMA,
    version: INTELLIGENCE_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    today: todayYmd(),
    health,
    ots: otsList.filter(isOtClima),
    flota: flotaList,
    mantenciones: mantList,
  };
}

const severityOrder = { critical: 0, warning: 1, info: 2 };

/**
 * Diagnósticos automáticos (lista priorizada).
 */
export function collectDiagnostics(snapshot) {
  const out = [];
  const push = (d) => out.push(d);

  for (const ot of snapshot.ots) {
    const id = ot.id || '—';
    const cliente = ot.cliente || '—';

    if (ot.estado === 'terminado') {
      const hasPdf = Boolean(ot.pdfUrl && String(ot.pdfUrl).trim());
      if (!hasPdf) {
        push({
          severity: 'warning',
          code: 'OT_TERMINADA_SIN_PDF',
          domain: 'clima',
          title: 'OT cerrada sin informe PDF en datos',
          detail: `${id} · ${cliente}`,
          ref: { type: 'ot', id },
          module: 'clima',
        });
      }
      const mc = roundMoney(ot.montoCobrado);
      if (mc <= 0) {
        push({
          severity: 'critical',
          code: 'OT_CERRADA_SIN_COBRO',
          domain: 'clima',
          title: 'OT terminada sin monto cobrado registrado',
          detail: `${id} · ${cliente}`,
          ref: { type: 'ot', id },
          module: 'clima',
        });
      }
      continue;
    }

    const brief = buildOtOperationalBrief(ot, { economicsSaved: economicsPersistedOk(ot) });
    const mc = roundMoney(ot.montoCobrado);
    const ct = roundMoney(ot.costoTotal);
    const util = roundMoney(ot.utilidad ?? mc - ct);
    if (mc > 0 && util < 0) {
      push({
        severity: 'warning',
        code: 'OT_MARGEN_NEGATIVO',
        domain: 'clima',
        title: 'Utilidad negativa con cobro registrado',
        detail: `${id} · ${cliente} · utilidad ${util.toLocaleString('es-CL')} CLP`,
        ref: { type: 'ot', id },
        module: 'clima',
      });
    }

    if (economicsPersistedOk(ot) && otCanClose(ot)) {
      push({
        severity: 'info',
        code: 'OT_LISTA_PARA_CERRAR',
        domain: 'clima',
        title: 'Lista para cierre e informe final',
        detail: `${id} · ${cliente}`,
        ref: { type: 'ot', id },
        module: 'clima',
      });
    } else if (brief.blockers.length) {
      push({
        severity: 'warning',
        code: 'OT_BLOQUEOS_CIERRE',
        domain: 'clima',
        title: 'OT abierta con pendientes de cierre',
        detail: `${id} · ${cliente}: ${brief.blockers[0]?.detail || 'revisar checklist'}`,
        ref: { type: 'ot', id },
        module: 'clima',
      });
    }
  }

  for (const s of snapshot.flota) {
    const id = s.id || '—';
    const estado = s.estado || 'recibida';
    if (estado === 'cerrada') {
      if (roundMoney(s.costoTotal) <= 0) {
        push({
          severity: 'warning',
          code: 'FLOTA_CERRADA_SIN_INGRESO',
          domain: 'flota',
          title: 'Solicitud cerrada sin costo operativo registrado',
          detail: `${id} · ${s.cliente || '—'}`,
          ref: { type: 'flotaSolicitud', id },
          module: 'flota',
        });
      }
      continue;
    }

    const brief = buildFlotaOperationalBrief(s);
    const next = flotaNextEstado(estado);
    if (brief.blockers.length && next) {
      push({
        severity: 'warning',
        code: 'FLOTA_BLOQUEO_AVANCE',
        domain: 'flota',
        title: `No puede avanzar a «${FLOTA_ESTADO_LABELS[next] || next}»`,
        detail: `${id} · ${brief.blockers.map((b) => b.detail).join('; ')}`,
        ref: { type: 'flotaSolicitud', id },
        module: 'flota',
      });
    }

    const age = daysBetweenYmd(s.fecha, snapshot.today);
    if (age != null && age > 14 && estado === 'recibida') {
      push({
        severity: 'info',
        code: 'FLOTA_ANTIGUA_RECIBIDA',
        domain: 'flota',
        title: 'Solicitud muy antigua en «Recibida»',
        detail: `${id} · ${s.cliente || '—'} · ${s.fecha}`,
        ref: { type: 'flotaSolicitud', id },
        module: 'flota',
      });
    }
  }

  for (const m of snapshot.mantenciones) {
    const fe = m.fecha;
    const est = String(m.estado || '');
    if (!fe || est === 'realizado') continue;
    const cmp = String(fe).localeCompare(snapshot.today);
    if (cmp < 0) {
      push({
        severity: 'warning',
        code: 'MANTENCION_VENCIDA',
        domain: 'planificacion',
        title: 'Mantención no marcada como realizada con fecha pasada',
        detail: `${m.id || '—'} · ${fe} · estado «${est}»`,
        ref: { type: 'mantencion', id: m.id },
        module: 'planificacion',
      });
    }
  }

  out.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return out;
}

/**
 * Borradores de acciones (no envían nada): mensajes sugeridos para operador.
 */
export function prepareDraftActions(snapshot) {
  const drafts = [];
  const readyOts = snapshot.ots.filter(
    (ot) => ot.estado !== 'terminado' && economicsPersistedOk(ot) && otCanClose(ot)
  );
  for (const ot of readyOts.slice(0, 8)) {
    drafts.push({
      kind: 'cliente_borrador',
      channel: 'sugerido',
      subject: `Resumen visita ${ot.cliente || ''} (${ot.fecha || ''})`,
      body: `Estimado cliente,\n\nAdjuntamos el cierre de la visita técnica del ${ot.fecha || '—'} en ${ot.direccion || 'su instalación'}.\n\nSaludos,\nHNF Servicios Integrales`,
      ref: { type: 'ot', id: ot.id },
    });
  }

  const openOts = snapshot.ots.filter((o) => o.estado !== 'terminado').slice(0, 5);
  for (const ot of openOts) {
    drafts.push({
      kind: 'tecnico_resumen',
      channel: 'interno',
      subject: `Checklist terreno · ${ot.id}`,
      body: `OT ${ot.id} · ${ot.cliente}\n- Equipos: ${ot.equipos?.length || 0}\n- Estado: ${ot.estado}\n- Completar evidencias y texto de visita antes de cierre.`,
      ref: { type: 'ot', id: ot.id },
    });
  }

  return drafts;
}

export const ASSISTANT_PRESETS = [
  { id: 'pendientes_hoy', label: '¿Qué está pendiente hoy?' },
  { id: 'cerrar_ot', label: '¿Qué OT debo cerrar?' },
  { id: 'sin_cobro', label: '¿Qué trabajos no están cobrados?' },
  { id: 'flota_resumen', label: '¿Cómo está la flota?' },
  { id: 'planificacion_riesgo', label: '¿Mantenciones atrasadas?' },
  { id: 'borradores', label: 'Borradores sugeridos (mensajes / interno)' },
];

/**
 * Interpretación liviana de texto libre → id de consulta preset.
 */
export function matchAssistantIntent(text) {
  const t = String(text || '').toLowerCase();

  if (/^ayuda$|^help$/.test(t.trim())) return 'help';
  if (/pendiente|hoy|agenda|que hay/.test(t) && !/cerrar/.test(t)) return 'pendientes_hoy';
  if (/cerrar|cierre|terminar/.test(t) && /ot|orden|visita/.test(t)) return 'cerrar_ot';
  if (/cobr|factur|pago|ingreso|plata/.test(t)) return 'sin_cobro';
  if (/flota|traslado|solicitud|ruta/.test(t)) return 'flota_resumen';
  if (/manten|planif|atras|venc/.test(t)) return 'planificacion_riesgo';
  if (/borrador|mensaje|mail|correo|cliente/.test(t)) return 'borradores';
  if (/riesgo|alerta|problema|urgente/.test(t)) return 'diagnostico';

  return null;
}

function formatList(items, emptyMsg) {
  if (!items.length) return [emptyMsg];
  return items;
}

/**
 * Ejecuta una consulta del asistente y devuelve bloques de UI.
 */
export function runAssistantQuery(queryId, snapshot) {
  try {
    intelligenceLog('info', 'QUERY', queryId, { today: snapshot.today });

    const diagnostics = collectDiagnostics(snapshot);
    const mem = loadBusinessMemory();
    const clienteHints = Object.keys(mem.byCliente || {}).length;

    if (queryId === 'help' || !queryId) {
      return {
        title: 'Cómo usar el asistente',
        intro: 'Elegí una pregunta rápida o escribí en el buscador (ej. «cobros», «cerrar OT», «flota»).',
        bullets: ASSISTANT_PRESETS.map((p) => p.label),
        foot: 'El análisis es local y determinista; no sustituye la revisión en Clima / Flota / Planificación.',
      };
    }

    if (queryId === 'diagnostico' || queryId === 'auto') {
      const critical = diagnostics.filter((d) => d.severity === 'critical').length;
      const warning = diagnostics.filter((d) => d.severity === 'warning').length;
      const info = diagnostics.filter((d) => d.severity === 'info').length;
      return {
        title: 'Diagnóstico automático',
        intro: `Análisis con datos cargados (${snapshot.generatedAt.slice(0, 19)}). Hallazgos: ${critical} críticos, ${warning} advertencias, ${info} informativos. Memoria operativa local: ${clienteHints} cliente(s) con pistas guardadas.`,
        bullets: diagnostics.slice(0, 12).map((d) => `«${d.title}» — ${d.detail}`),
        foot: 'Las sugerencias son internas; verificá siempre en Clima / Flota / Planificación antes de actuar.',
      };
    }

    if (queryId === 'pendientes_hoy') {
      const t = snapshot.today;
      const otHoy = snapshot.ots.filter((o) => String(o.fecha) === t && o.estado !== 'terminado');
      const flHoy = snapshot.flota.filter((s) => String(s.fecha) === t && s.estado !== 'cerrada');
      const manHoy = snapshot.mantenciones.filter(
        (m) => String(m.fecha) === t && String(m.estado) !== 'realizado'
      );
      return {
        title: 'Pendientes para la fecha de hoy',
        intro: `Fecha de referencia: ${t} (zona horaria del navegador).`,
        bullets: formatList(
          [
            ...otHoy.map((o) => `OT ${o.id} · ${o.cliente} · estado «${o.estado}»`),
            ...flHoy.map((s) => `Flota ${s.id} · ${s.cliente} · «${s.estado}»`),
            ...manHoy.map((m) => `Mantención ${m.id} · ${m.fecha} · «${m.estado}»`),
          ],
          'No hay ítems pendientes registrados para hoy en los datos actuales.'
        ),
        foot: 'Si falta algo, puede tener otra fecha o aún no sincronizó el servidor.',
      };
    }

    if (queryId === 'cerrar_ot') {
      const listos = snapshot.ots.filter(
        (ot) => ot.estado !== 'terminado' && economicsPersistedOk(ot) && otCanClose(ot)
      );
      const casi = snapshot.ots
        .filter((ot) => ot.estado !== 'terminado' && !(economicsPersistedOk(ot) && otCanClose(ot)))
        .map((ot) => {
          const b = buildOtOperationalBrief(ot, { economicsSaved: economicsPersistedOk(ot) });
          return { ot, n: b.blockers.length };
        })
        .filter((x) => x.n > 0)
        .slice(0, 8);

      return {
        title: 'Órdenes de trabajo y cierre',
        intro:
          listos.length > 0
            ? 'Estas OT cumplen requisitos para «Cerrar OT e informe final» según datos en servidor (evidencias, texto de visita y economía válida).'
            : 'Ninguna OT abierta cumple todos los requisitos de cierre con los datos actuales.',
        bullets: [
          ...listos.map((o) => `Cerrar: ${o.id} · ${o.cliente} · ${o.fecha || '—'}`),
          ...casi.map(
            ({ ot }) =>
              `Pendiente: ${ot.id} · ${ot.cliente} — ${buildOtOperationalBrief(ot, { economicsSaved: economicsPersistedOk(ot) }).blockers[0]?.detail || 'revisar'}`
          ),
        ],
        foot: 'En Clima usá el checklist operativo y guardá cada bloque antes del cierre.',
      };
    }

    if (queryId === 'sin_cobro') {
      const otSin = snapshot.ots.filter(
        (o) => o.estado !== 'terminado' && roundMoney(o.montoCobrado) <= 0
      );
      const otCerrSin = snapshot.ots.filter(
        (o) => o.estado === 'terminado' && roundMoney(o.montoCobrado) <= 0
      );
      const fl = snapshot.flota.filter((s) => s.estado === 'cerrada' && roundMoney(s.costoTotal) <= 0);
      return {
        title: 'Cobros e ingresos registrados',
        intro:
          'Trabajos sin monto cobrado (Clima) o flota cerrada sin costo operativo (combustible + peaje + externo).',
        bullets: formatList(
          [
            ...otSin.map((o) => `OT abierta ${o.id} · ${o.cliente} · monto cobrado 0`),
            ...otCerrSin.map((o) => `OT terminada ${o.id} · ${o.cliente} · revisar facturación`),
            ...fl.map((s) => `Flota cerrada ${s.id} · ${s.cliente} · sin costos operativos`),
          ],
          'No se detectaron casos flag en esta categoría.'
        ),
        foot: 'En Flota: costos directos y cierre con observación; en Clima: «Guardar resultado económico».',
      };
    }

    if (queryId === 'flota_resumen') {
      const diagFlota = collectDiagnostics(snapshot);
      const byEst = new Map();
      for (const s of snapshot.flota) {
        const e = s.estado || 'recibida';
        byEst.set(e, (byEst.get(e) || 0) + 1);
      }
      const lines = [...byEst.entries()].sort((a, b) => b[1] - a[1]).map(([e, n]) => `«${e}»: ${n}`);
      const bloq = diagFlota.filter((d) => d.domain === 'flota' && d.severity !== 'info');
      return {
        title: 'Estado de la flota',
        intro: `Total solicitudes en datos: ${snapshot.flota.length}.`,
        bullets: [
          ...lines,
          ...(bloq.length
            ? ['—', ...bloq.slice(0, 6).map((d) => `${d.title}: ${d.detail}`)]
            : ['Sin bloqueos de avance detectados para el siguiente paso.']),
        ],
        foot: 'Avanzá estados desde Flota con «Siguiente» o guardando antes los costos.',
      };
    }

    if (queryId === 'planificacion_riesgo') {
      const diagPlan = collectDiagnostics(snapshot);
      const venc = diagPlan.filter((d) => d.code === 'MANTENCION_VENCIDA');
      return {
        title: 'Mantenciones y riesgo de calendario',
        intro: `Mantenciones en datos: ${snapshot.mantenciones.length}. Con fecha pasada y no realizadas: ${venc.length}.`,
        bullets: formatList(
          venc.slice(0, 15).map((d) => d.detail),
          'No hay mantenciones vencidas sin estado realizado.'
        ),
        foot: 'Actualizá estados en Planificación · Mantenciones.',
      };
    }

    if (queryId === 'borradores') {
      const drafts = prepareDraftActions(snapshot);
      return {
        title: 'Borradores (no enviados)',
        intro: 'Textos sugeridos para copiar y adaptar. No se envían automáticamente.',
        bullets: drafts.slice(0, 6).map((d) => `${d.kind} · ${d.subject}\n${d.body.slice(0, 220)}${d.body.length > 220 ? '…' : ''}`),
        foot: 'Futuro: integración con correo / WhatsApp desde el mismo panel.',
      };
    }

    return {
      title: 'Asistente HNF',
      intro: 'No reconocí la consulta. Probá las preguntas sugeridas o escribí palabras como: pendiente, cerrar OT, cobro, flota, mantención.',
      bullets: ASSISTANT_PRESETS.map((p) => p.label),
      foot: null,
    };
  } catch (e) {
    intelligenceLog('error', 'QUERY_FAIL', String(e?.message || e), { queryId });
    return {
      title: 'Error al analizar',
      intro: 'Ocurrió un error interno al procesar los datos. Los demás módulos siguen disponibles.',
      bullets: [String(e?.message || e)],
      foot: 'Si persiste, recargá la página y verificá la consola con hnf.debugIntel = 1 en localStorage.',
    };
  }
}

/**
 * Salida para modo automático futuro: priorización simple.
 */
export function buildPriorityQueue(snapshot) {
  const diagnostics = collectDiagnostics(snapshot);
  return diagnostics
    .filter((d) => d.severity === 'critical' || d.severity === 'warning')
    .slice(0, 20)
    .map((d, i) => ({ rank: i + 1, ...d }));
}
