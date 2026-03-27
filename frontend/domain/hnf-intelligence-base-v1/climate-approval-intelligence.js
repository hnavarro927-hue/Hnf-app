/**
 * Inteligencia de aprobaciones Clima — correo (Romina ↔ tiendas) + calendario / mantenciones.
 */

import { classifyOutlookMessage } from '../outlook-intelligence.js';

export const HNF_CLIMATE_APPROVAL_VERSION = '2026-03-27-v1';

/** Estados operativos de la cadena de permiso/aprobación. */
export const CLIMATE_APPROVAL_STATE = {
  PENDIENTE: 'pendiente_aprobacion',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  REPROGRAMAR: 'reprogramar',
  SIN_RESPUESTA: 'sin_respuesta',
};

export const CLIMATE_APPROVAL_LABEL = {
  [CLIMATE_APPROVAL_STATE.PENDIENTE]: 'Pendiente de aprobación',
  [CLIMATE_APPROVAL_STATE.APROBADO]: 'Aprobado',
  [CLIMATE_APPROVAL_STATE.RECHAZADO]: 'Rechazado',
  [CLIMATE_APPROVAL_STATE.REPROGRAMAR]: 'Reprogramar',
  [CLIMATE_APPROVAL_STATE.SIN_RESPUESTA]: 'Sin respuesta',
};

function blob(m) {
  return `${m?.subject || ''} ${m?.bodyText || ''} ${m?.bodyHtml || ''}`;
}

/**
 * Clasificación extendida para flujo operativo de permisos (no solo administrativo).
 */
export function classifyClimateApprovalEmail(message) {
  const t = blob(message).toLowerCase();
  const base = classifyOutlookMessage(message, {});

  let estado = CLIMATE_APPROVAL_STATE.SIN_RESPUESTA;

  if (/\b(rechaz|no autoriz|denegad|imposible\s+acceder)\b/i.test(t)) {
    estado = CLIMATE_APPROVAL_STATE.RECHAZADO;
  } else if (/\b(reprogram|posterg|nueva fecha|cambiar fecha|correr visita)\b/i.test(t)) {
    estado = CLIMATE_APPROVAL_STATE.REPROGRAMAR;
  } else if (/\b(aprobado|aprobamos|queda confirmad|ok para visita|autorizad)\b/i.test(t)) {
    estado = CLIMATE_APPROVAL_STATE.APROBADO;
  } else if (/\b(solicitud de permiso|solicito permiso|pedimos permiso|permiso para)\b/i.test(t)) {
    estado = CLIMATE_APPROVAL_STATE.PENDIENTE;
  } else if (/\bpermiso\b/i.test(t) && !/\b(aprobado|rechaz)\b/i.test(t)) {
    estado = CLIMATE_APPROVAL_STATE.PENDIENTE;
  }

  const fechaMatch =
    t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/) ||
    t.match(/(\d{4}-\d{2}-\d{2})/);
  const fechaSugerida = fechaMatch ? fechaMatch[1] : null;

  return {
    ...base,
    climateApprovalEstado: estado,
    climateApprovalLabel: CLIMATE_APPROVAL_LABEL[estado],
    fechaMencionada: fechaSugerida,
    esFlujoClima: /\b(permiso|tienda|local|mall|mantenc|visita|clima|hvac)\b/i.test(t),
  };
}

function weekRange() {
  const t = new Date();
  const day = t.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(t);
  mon.setDate(t.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const p = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { desde: p(mon), hasta: p(sun) };
}

/**
 * Relaciona mensajes clasificados con mantenciones / entradas de calendario por cliente y fecha aproximada.
 */
export function buildClimateApprovalBoard(viewData = {}) {
  const messages = Array.isArray(viewData?.outlookFeed?.messages)
    ? viewData.outlookFeed.messages
    : [];
  const mant = Array.isArray(viewData?.planMantenciones) ? viewData.planMantenciones : [];
  const classified = messages.map((m) => ({
    id: m.id || m.messageId,
    subject: String(m.subject || '').slice(0, 120),
    receivedAt: m.receivedAt,
    clientHint: m.clientHint,
    ...classifyClimateApprovalEmail(m),
  }));

  const byEstado = {
    [CLIMATE_APPROVAL_STATE.PENDIENTE]: [],
    [CLIMATE_APPROVAL_STATE.APROBADO]: [],
    [CLIMATE_APPROVAL_STATE.RECHAZADO]: [],
    [CLIMATE_APPROVAL_STATE.REPROGRAMAR]: [],
    [CLIMATE_APPROVAL_STATE.SIN_RESPUESTA]: [],
  };
  for (const c of classified) {
    if (!c.esFlujoClima && c.climateApprovalEstado === CLIMATE_APPROVAL_STATE.SIN_RESPUESTA) continue;
    const k = c.climateApprovalEstado;
    if (byEstado[k]) byEstado[k].push(c);
    else byEstado[CLIMATE_APPROVAL_STATE.SIN_RESPUESTA].push(c);
  }

  const { desde, hasta } = weekRange();
  const mantSemana = mant.filter((m) => {
    const f = String(m.fecha || '').slice(0, 10);
    return f >= desde && f <= hasta;
  });

  const tiendasSinAprobacion = [];
  for (const row of mantSemana) {
    const label = String(row.tiendaNombre || row.cliente || row.tiendaId || '').trim();
    if (!label) continue;
    const nl = label.toLowerCase();
    const fecha = String(row.fecha || '').slice(0, 10);
    const aprobado = classified.some((c) => {
      if (c.climateApprovalEstado !== CLIMATE_APPROVAL_STATE.APROBADO) return false;
      const b = `${c.subject || ''} ${c.clientHint || ''}`.toLowerCase();
      return b.includes(nl);
    });
    if (!aprobado) {
      tiendasSinAprobacion.push({
        tienda: label,
        fecha,
        tipo: row.tipo || row.estado,
      });
    }
  }

  return {
    version: HNF_CLIMATE_APPROVAL_VERSION,
    week: { desde, hasta },
    emailByEstado: byEstado,
    classifiedCount: classified.filter((c) => c.esFlujoClima).length,
    mantencionesSemana: mantSemana.length,
    tiendasPendientesAprobacion: tiendasSinAprobacion,
    rawClassified: classified.filter((c) => c.esFlujoClima).slice(0, 40),
  };
}

/**
 * Respuestas naturales para consultas de aprobación (copiloto).
 */
export function answerClimateApprovalQuery(normalizedQuery, board) {
  const q = normalizedQuery;
  if (
    !q.includes('aprob') &&
    !q.includes('permiso') &&
    !q.includes('tienda') &&
    !q.includes('mantenc') &&
    !q.includes('semana') &&
    !q.includes('correo clima')
  ) {
    return null;
  }

  const aprob = board.emailByEstado[CLIMATE_APPROVAL_STATE.APROBADO].length;
  const pend = board.emailByEstado[CLIMATE_APPROVAL_STATE.PENDIENTE].length;
  const rech = board.emailByEstado[CLIMATE_APPROVAL_STATE.RECHAZADO].length;
  const repro = board.emailByEstado[CLIMATE_APPROVAL_STATE.REPROGRAMAR].length;
  const sin = board.emailByEstado[CLIMATE_APPROVAL_STATE.SIN_RESPUESTA].filter((x) => x.esFlujoClima).length;

  let datos = `Semana ${board.week.desde} → ${board.week.hasta}: ${board.mantencionesSemana} mantenciones en planilla; correos Clima/permiso clasificados: ${board.classifiedCount}. Estados en correo: ${aprob} aprobados, ${pend} pendientes explícitos, ${rech} rechazos, ${repro} reprogramaciones, ${sin} sin respuesta clara.`;
  if (board.tiendasPendientesAprobacion.length) {
    datos += ` ${board.tiendasPendientesAprobacion.length} visita(s) programadas sin evidencia de aprobación vinculada en correo.`;
  }

  const accion =
    pend > 0 || board.tiendasPendientesAprobacion.length
      ? 'Romina: revisá bandeja / Centro de ingesta correo antes de confirmar visita o enviar equipo.'
      : 'Mantener monitoreo de hilos de permiso en la semana de ejecución.';

  const mejora =
    'Conviene consolidar panel de aprobaciones por tienda y semana (estado único por sucursal).';

  return { datos, accionSugerida: accion, mejoraSugerida: mejora };
}
