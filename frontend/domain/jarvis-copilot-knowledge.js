/**
 * Arquitectura de conocimiento Jarvis Copilot — capas y proveedores (extensible).
 *
 * Capas:
 * - structured: clientes, técnicos, OT, estados, asignaciones (datos en memoria)
 * - process: reglas de negocio, roles, escalamiento, buenas prácticas (catálogo local)
 * - documents: manuales, contratos, procedimientos (stub → RAG / API futura)
 */

export const JARVIS_KNOWLEDGE_ARCH_VERSION = '2026-03-27';

/** @enum {string} */
export const KNOWLEDGE_LAYER = {
  STRUCTURED: 'structured',
  PROCESS: 'process',
  DOCUMENTS: 'documents',
};

/**
 * Catálogo mínimo de reglas operativas HNF (Romina / Gery / comando).
 * Las respuestas del copiloto pueden citar estas claves en metadata.
 */
export const HNF_PROCESS_RULES = {
  ingresoAntesClima: {
    id: 'ingresoAntesClima',
    texto: 'Ingreso registra canal y datos mínimos; Clima ejecuta visita, evidencias e informe.',
    roles: ['Romina', 'Gery', 'operador'],
  },
  asignacionAntesEjecucion: {
    id: 'asignacionAntesEjecucion',
    texto: 'No se programa visita sin técnico asignado salvo excepción explícita del mando.',
    roles: ['Romina', 'Jarvis'],
  },
  evidenciaAntesCierre: {
    id: 'evidenciaAntesCierre',
    texto: 'Cierre ordenado requiere evidencia y resumen coherentes con el trabajo declarado.',
    roles: ['Romina', 'Gery'],
  },
  emergenciasPrioridad: {
    id: 'emergenciasPrioridad',
    texto: 'Emergencias HVAC y flota crítica: prioridad alta y seguimiento en panel en vivo.',
    roles: ['Jarvis', 'Romina', 'Gery'],
  },
};

/**
 * Resumen estructurado desde la vista actual (sin backend nuevo).
 * @param {object} data
 * @param {object[]} cards
 */
export function buildStructuredKnowledgeSnapshot(data, cards = []) {
  const rawClients = data?.clients?.data ?? data?.clients;
  const clientList = Array.isArray(rawClients) ? rawClients : [];
  const ots = data?.planOts ?? data?.ots?.data ?? [];
  const list = Array.isArray(ots) ? ots : [];
  const abiertas = list.filter((o) => {
    const st = String(o?.estado || '').toLowerCase();
    return st && !['terminado', 'cerrado', 'cancelado'].includes(st);
  });
  const techs = new Set();
  for (const o of abiertas) {
    const t = String(o?.tecnicoAsignado || '').trim();
    if (t && !/^sin\s+asignar$/i.test(t) && t.toLowerCase() !== 'por asignar') techs.add(t);
  }
  return {
    layer: KNOWLEDGE_LAYER.STRUCTURED,
    version: 1,
    clientCount: clientList.length,
    openOtCount: abiertas.length,
    totalOtInCut: list.length,
    techniciansActive: [...techs].sort((a, b) => a.localeCompare(b, 'es')),
    controlCardCount: Array.isArray(cards) ? cards.length : 0,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Stub documental — futuro: conectar índice de manuales / contratos / procedimientos.
 */
export function buildDocumentKnowledgeStub() {
  return {
    layer: KNOWLEDGE_LAYER.DOCUMENTS,
    available: false,
    note:
      'Capa documental lista para conectar (manuales, contratos, instrucciones de servicio). Por ahora no se consulta en red.',
    version: 0,
  };
}

/**
 * Paquete combinado para el motor de inteligencia / LLM futuro.
 */
export function buildJarvisKnowledgeBundle(data, controlCards = []) {
  return {
    archVersion: JARVIS_KNOWLEDGE_ARCH_VERSION,
    structured: buildStructuredKnowledgeSnapshot(data, controlCards),
    process: {
      layer: KNOWLEDGE_LAYER.PROCESS,
      rules: HNF_PROCESS_RULES,
    },
    documents: buildDocumentKnowledgeStub(),
  };
}
