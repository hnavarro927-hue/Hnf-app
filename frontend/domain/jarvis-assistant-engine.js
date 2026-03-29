/**
 * Asistente Jarvis — copiloto operativo: datos en vivo + capa de inteligencia + reglas.
 * Extensible: OpenAI / RAG / documentos vía jarvis-copilot-knowledge + consultas async.
 */

import { getEvidenceGaps } from '../utils/ot-evidence.js';
import { buildCopilotIntelligence } from './jarvis-copilot-intelligence.js';
import {
  buildJarvisKnowledgeBundle,
  JARVIS_KNOWLEDGE_ARCH_VERSION,
} from './jarvis-copilot-knowledge.js';
import {
  queryHnfIntelligenceBaseV1,
  buildHnfIntelligenceBaseV1Snapshot,
  HNF_INTELLIGENCE_BASE_VERSION,
} from './hnf-intelligence-base-v1/index.js';

export const JARVIS_ASSISTANT_ENGINE_VERSION = '2026-03-27-copilot';

const CLOSED = new Set(['terminado', 'cerrada', 'cerrado', 'cancelado']);

function planOtsFromData(data) {
  const ots = data?.planOts ?? data?.ots?.data ?? [];
  return Array.isArray(ots) ? ots : [];
}

function isOtAbierta(ot) {
  const st = String(ot?.estado || '').trim().toLowerCase();
  return Boolean(st) && !CLOSED.has(st);
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
  const id = String(ot?.id || '').trim();
  if (!id) return false;
  for (const c of Array.isArray(cards) ? cards : []) {
    if (String(c?.otId || '').trim() === id && c?.global === 'rojo') return true;
  }
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

function formatLegacyBody(r) {
  const parts = [];
  if (r.datos) parts.push(r.datos);
  if (r.accionSugerida) parts.push(`Acción sugerida: ${r.accionSugerida}`);
  if (r.mejoraSugerida) parts.push(`Mejora sugerida: ${r.mejoraSugerida}`);
  return parts.join('\n\n').trim();
}

/**
 * Respuesta estructurada del copiloto (datos + acción + mejora).
 * @param {string} userText
 * @param {{ data?: object, controlCards?: object[], includeKnowledgeBundle?: boolean }} ctx
 */
export function processJarvisCopilotQuery(userText, ctx = {}) {
  const data = ctx.data && typeof ctx.data === 'object' ? ctx.data : {};
  const cards = Array.isArray(ctx.controlCards) ? ctx.controlCards : [];
  const todas = planOtsFromData(data);
  const abiertas = todas.filter(isOtAbierta);

  const q = normalizeQuery(userText);

  if (q) {
    const ib = queryHnfIntelligenceBaseV1(userText, data, cards);
    if (ib) {
      const out = {
        intent: ib.intent,
        datos: ib.datos,
        accionSugerida: ib.accionSugerida,
        mejoraSugerida: ib.mejoraSugerida,
        knowledge: {
          archVersion: JARVIS_KNOWLEDGE_ARCH_VERSION,
          layersConsulted: ['structured', 'process', 'hnf_intelligence_base_v1'],
          documentLayerReady: false,
          intelligenceBaseVersion: HNF_INTELLIGENCE_BASE_VERSION,
        },
      };
      if (ctx.includeKnowledgeBundle) out.knowledgeBundle = buildJarvisKnowledgeBundle(data, cards);
      return out;
    }
  }

  if (!q) {
    const intel = buildCopilotIntelligence({
      intent: 'empty',
      abiertas,
      cards,
      focusOts: [],
    });
    const out = {
      intent: 'empty',
      datos:
        'Escribí una consulta operativa. Atajos: «resumen», «urgentes», «sin asignar», «pendientes», «aprobaciones» / «permisos Clima», «flujo OT», «demoras».',
      accionSugerida: null,
      mejoraSugerida: intel.mejoraSugerida,
      knowledge: {
        archVersion: JARVIS_KNOWLEDGE_ARCH_VERSION,
        layersConsulted: intel.layersUsed,
        documentLayerReady: false,
      },
    };
    if (ctx.includeKnowledgeBundle) out.knowledgeBundle = buildJarvisKnowledgeBundle(data, cards);
    return out;
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

  let intent = 'help';
  let datos = '';
  let focusOts = [];

  if (resumen) {
    intent = 'resumen';
    const nAb = abiertas.length;
    const urg = abiertas.filter((o) => otUrgenteHeuristic(o, cards));
    const sinInf = abiertas.filter(otSinInformeOperativo);
    const sinTec = abiertas.filter(tecnicoSinAsignar);
    const hintUrg = topClientesHint(urg);
    const lineHint =
      hintUrg.length && urg.length ? `Priorizá ${hintUrg.join(' · ')}.` : '';
    datos = [
      `${nAb} OT abiertas; ${urg.length} urgentes (señal o texto); ${sinInf.length} con informe o evidencia pendiente; ${sinTec.length} sin técnico.`,
      nAb === 0
        ? 'Sin OT abiertas en el corte cargado: sincronizá o abrí Clima para traer datos.'
        : lineHint,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    focusOts = [...urg, ...sinTec].slice(0, 3);
  } else if (urgentesKw) {
    intent = 'urgentes';
    const list = abiertas.filter((o) => otUrgenteHeuristic(o, cards));
    focusOts = list.slice(0, 5);
    if (!list.length) {
      datos =
        'No marqué OT abiertas como urgentes (ni rojas en panel ni texto). Revisá Clima si necesitás subir prioridad o etiquetar emergencia.';
    } else {
      const hint = topClientesHint(list);
      datos = [
        `${list.length} OT urgentes.${hint.length ? ` Clientes destacados: ${hint.join(' · ')}.` : ''}`,
        ...listar(list),
      ].join('\n');
    }
  } else if (sinAsignarKw) {
    intent = 'sin_asignar';
    const list = abiertas.filter(tecnicoSinAsignar);
    focusOts = list.slice(0, 5);
    if (!list.length) {
      datos = 'Todas las OT abiertas tienen técnico asignado en el corte actual.';
    } else {
      const hint = topClientesHint(list);
      datos = [
        `${list.length} OT sin técnico.${hint.length ? ` Ejemplos de cliente: ${hint.join(' · ')}.` : ''}`,
        ...listar(list),
      ].join('\n');
    }
  } else if (pendientesKw) {
    intent = 'pendientes';
    const list = abiertas.filter(otSinInformeOperativo);
    focusOts = list.slice(0, 5);
    if (!list.length) {
      datos = 'No hay OT abiertas con informe o evidencia pendiente según lo cargado en esta sesión.';
    } else {
      datos = [
        `${list.length} OT con informe o evidencia pendiente (PDF, fotos o resumen).`,
        ...listar(list),
      ].join('\n');
    }
  } else {
    intent = 'help';
    datos =
      'No reconozco ese pedido. Probá «resumen», «urgentes», «sin asignar», «pendientes», o preguntas HNF: «¿qué permisos pendientes?», «flujo OT», «demoras», «reglas operativas». Datos desde la sesión cargada.';
  }

  const intel = buildCopilotIntelligence({ intent, abiertas, cards, focusOts });
  if (intent === 'resumen') {
    const ibSnap = buildHnfIntelligenceBaseV1Snapshot(data, cards);
    const extra = ibSnap.recommendations[0]?.mejoraSugerida;
    if (extra) {
      intel.mejoraSugerida = intel.mejoraSugerida ? `${intel.mejoraSugerida} ${extra}` : extra;
    }
  }
  let datosFinal = datos;
  if (intel.riesgoTexto) {
    datosFinal = `${intel.riesgoTexto}\n\n${datos}`;
  }

  const out = {
    intent,
    datos: datosFinal,
    accionSugerida: intel.accionSugerida,
    mejoraSugerida: intel.mejoraSugerida,
    knowledge: {
      archVersion: JARVIS_KNOWLEDGE_ARCH_VERSION,
      layersConsulted: intel.layersUsed,
      documentLayerReady: false,
    },
  };
  if (ctx.includeKnowledgeBundle) out.knowledgeBundle = buildJarvisKnowledgeBundle(data, cards);
  return out;
}

/**
 * @returns {Promise<ReturnType<typeof processJarvisCopilotQuery>>}
 */
export async function processJarvisCopilotQueryAsync(userText, ctx) {
  return processJarvisCopilotQuery(userText, ctx);
}

/**
 * Compatible con integraciones que esperan { intent, body }.
 * @returns {ReturnType<typeof processJarvisCopilotQuery> & { body: string }}
 */
export function processJarvisAssistantQuery(userText, ctx = {}) {
  const r = processJarvisCopilotQuery(userText, ctx);
  return { ...r, body: formatLegacyBody(r) };
}

/**
 * @deprecated Usar processJarvisCopilotQueryAsync
 */
export async function processJarvisAssistantQueryAsync(userText, ctx) {
  const r = await processJarvisCopilotQueryAsync(userText, ctx);
  return { ...r, body: formatLegacyBody(r) };
}
