/**
 * Asistente Jarvis — capa de reglas sobre datos OT ya cargados en el cliente.
 * Extensible: más adelante se puede enrutar aquí OpenAI, RAG, etc. sin cambiar la UI.
 */

import { getEvidenceGaps } from '../utils/ot-evidence.js';

export const JARVIS_ASSISTANT_ENGINE_VERSION = '2026-03-27';

const CLOSED = new Set(['terminado', 'cerrado', 'cancelado']);

function planOtsFromData(data) {
  const ots = data?.planOts ?? data?.ots?.data ?? [];
  return Array.isArray(ots) ? ots : [];
}

function isOtAbierta(ot) {
  const st = String(ot?.estado || '').trim().toLowerCase();
  return Boolean(st) && !CLOSED.has(st);
}

function cardByOtId(cards, otId) {
  const id = String(otId || '').trim();
  if (!id) return null;
  for (const c of Array.isArray(cards) ? cards : []) {
    if (String(c?.otId || '').trim() === id) return c;
  }
  return null;
}

function tecnicoSinAsignar(ot) {
  const t = String(ot?.tecnicoAsignado || '').trim();
  if (!t) return true;
  const l = t.toLowerCase();
  return l === 'sin asignar' || l === 'por asignar';
}

function sinInformePdf(ot) {
  return !String(ot?.pdfUrl || '').trim();
}

function otUrgenteHeuristic(ot, cards) {
  const ctrl = cardByOtId(cards, ot?.id);
  if (ctrl?.global === 'rojo') return true;
  const blob = `${ot?.observaciones || ''} ${ot?.resumenTrabajo || ''}`.toLowerCase();
  if (/\burgent|urgencia|crític|critico|prioridad\s*:\s*urgente|prioridad\s*alta\b/.test(blob)) {
    return true;
  }
  const p = String(ot?.prioridad || ot?.prioridadServicio || '').toLowerCase();
  if (p && /alta|urgente|crit|critic/.test(p)) return true;
  return false;
}

function otSinInformeOperativo(ot) {
  if (!sinInformePdf(ot)) return false;
  const gaps = getEvidenceGaps(ot);
  const sinResumen = !String(ot?.resumenTrabajo || '').trim();
  return gaps.length > 0 || sinResumen;
}

function normalizeQuery(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function fmtOt(ot) {
  const id = String(ot?.id ?? '—').trim();
  const cli = String(ot?.cliente || 'Sin cliente')
    .trim()
    .slice(0, 36);
  return `• ${id} · ${cli}`;
}

function listar(ots, max = 10) {
  const slice = ots.slice(0, max);
  const lines = slice.map(fmtOt);
  const rest = ots.length - slice.length;
  if (rest > 0) lines.push(`… y ${rest} más (abrí Clima para el detalle).`);
  return lines;
}

function topClientesHint(ots, max = 2) {
  const map = new Map();
  for (const o of ots) {
    const c = String(o?.cliente || '').trim() || 'Sin nombre';
    map.set(c, (map.get(c) || 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, max).map(([name]) => name);
}

/**
 * @param {string} userText
 * @param {{ data?: object, controlCards?: object[] }} ctx
 * @returns {{ intent: string, body: string }}
 */
export function processJarvisAssistantQuery(userText, ctx = {}) {
  const data = ctx.data && typeof ctx.data === 'object' ? ctx.data : {};
  const cards = Array.isArray(ctx.controlCards) ? ctx.controlCards : [];
  const todas = planOtsFromData(data);
  const abiertas = todas.filter(isOtAbierta);

  const q = normalizeQuery(userText);

  if (!q) {
    return {
      intent: 'empty',
      body: 'Escribí una consulta. Atajos: «resumen», «urgentes», «sin asignar», «pendientes».',
    };
  }

  const resumen =
    q.includes('resumen') ||
    q.includes('estado') ||
    q.includes('cuantas') ||
    q.includes('cuántas') ||
    q.includes('panorama');

  const urgentesKw = q.includes('urgente') || q.includes('critica') || q.includes('critico');
  const sinAsignarKw =
    q.includes('sin asignar') ||
    q.includes('sin tecnico') ||
    q.includes('sin técnico') ||
    q.includes('por asignar');
  const pendientesKw =
    q.includes('pendiente') ||
    q.includes('sin informe') ||
    q.includes('informe pendiente') ||
    q.includes('sin reporte');

  if (resumen) {
    const nAb = abiertas.length;
    const urg = abiertas.filter((o) => otUrgenteHeuristic(o, cards));
    const sinInf = abiertas.filter(otSinInformeOperativo);
    const sinTec = abiertas.filter(tecnicoSinAsignar);
    const hintUrg = topClientesHint(urg);
    const lineHint =
      hintUrg.length && urg.length
        ? ` Priorizá ${hintUrg.join(' · ')}.`
        : '';
    const body = [
      `Resumen OT abiertas: ${nAb}.`,
      `Urgentes (señal / texto): ${urg.length}.`,
      `Sin informe completo o evidencia: ${sinInf.length}.`,
      `Sin técnico asignado: ${sinTec.length}.`,
      nAb === 0
        ? 'No hay OT abiertas en el corte cargado; sincronizá o abrí Clima.'
        : lineHint.trim(),
    ]
      .filter(Boolean)
      .join(' ');
    return { intent: 'resumen', body: body.replace(/\s+/g, ' ').trim() };
  }

  if (urgentesKw) {
    const list = abiertas.filter((o) => otUrgenteHeuristic(o, cards));
    if (!list.length) {
      return {
        intent: 'urgentes',
        body: 'No marqué OT abiertas como urgentes en este corte (ni rojas en panel ni texto). Revisá Clima si necesitás forzar prioridad.',
      };
    }
    const hint = topClientesHint(list);
    const head = `Tenés ${list.length} OT urgentes.${hint.length ? ` Priorizá ${hint.join(' · ')}.` : ''}`;
    return { intent: 'urgentes', body: [head, ...listar(list)].join('\n') };
  }

  if (sinAsignarKw) {
    const list = abiertas.filter(tecnicoSinAsignar);
    if (!list.length) {
      return {
        intent: 'sin_asignar',
        body: 'Todas las OT abiertas tienen técnico asignado en el dato actual.',
      };
    }
    const hint = topClientesHint(list);
    const head = `${list.length} OT sin técnico.${hint.length ? ` Ej.: ${hint.join(' · ')}.` : ''}`;
    return { intent: 'sin_asignar', body: [head, ...listar(list)].join('\n') };
  }

  if (pendientesKw) {
    const list = abiertas.filter(otSinInformeOperativo);
    if (!list.length) {
      return {
        intent: 'pendientes',
        body: 'No hay OT abiertas con informe/evidencia pendiente según el corte cargado.',
      };
    }
    const head = `${list.length} OT con informe o evidencia pendiente (sin PDF o faltan fotos/resumen).`;
    return { intent: 'pendientes', body: [head, ...listar(list)].join('\n') };
  }

  return {
    intent: 'help',
    body: 'No reconozco el comando. Probá: «resumen», «urgentes», «sin asignar», «pendientes». Los datos son las OT ya cargadas en esta sesión (sin llamar al servidor de nuevo).',
  };
}

/**
 * Hook futuro: reemplazar o combinar con modelo externo.
 * @returns {Promise<{ intent: string, body: string }>}
 */
export async function processJarvisAssistantQueryAsync(userText, ctx) {
  return processJarvisAssistantQuery(userText, ctx);
}
