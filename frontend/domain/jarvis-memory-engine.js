/**
 * JarvisMemoryEngine — capa única sobre memoria local: patrones, influencia en decisiones, registro autónomo.
 */

import {
  appendMemoryEvent,
  getJarvisMemorySummary,
  getJarvisRecurringPatterns,
  rememberJarvisBrief,
} from './jarvis-memory.js';

export const JARVIS_MEMORY_ENGINE_VERSION = '2026-03-24';

export const JarvisMemoryEngine = {
  version: JARVIS_MEMORY_ENGINE_VERSION,

  getPatterns() {
    return getJarvisRecurringPatterns();
  },

  getSummary() {
    return getJarvisMemorySummary();
  },

  /** Resumen corto para sesionar con buildJarvisDecisionEngine */
  getInfluenceHints() {
    const p = getJarvisRecurringPatterns();
    const hints = [];
    for (const t of p.textoPatrones || []) hints.push(t);
    for (const c of (p.cuellosRepetidos || []).slice(0, 2)) {
      hints.push(`Cuello repetido (${c.veces}×): ${c.frase}`);
    }
    return hints.slice(0, 5);
  },

  noteAutonomicTick(meta = {}) {
    appendMemoryEvent('autonomic_surface_tick', {
      at: new Date().toISOString(),
      ...meta,
    });
  },

  /** Persistir brief si viene del ciclo de carga (refuerza patrones) */
  rememberBriefIfAny(brief) {
    if (brief && typeof brief === 'object') {
      try {
        rememberJarvisBrief(brief);
      } catch {
        /* noop */
      }
    }
  },
};
