/**
 * Memoria evolutiva — patrones, repeticiones y señales que vuelven (no solo historial).
 */

import { getEvolutiveMemoryEvents, getJarvisMemorySummary, getJarvisRecurringPatterns } from './jarvis-memory.js';

export const JARVIS_MEMORIA_EVOLUTIVA_VERSION = '2026-03-24';

/**
 * @param {object} unified - getJarvisUnifiedState
 */
export function buildJarvisMemoriaEvolutiva(unified) {
  const u = unified || {};
  const patterns = getJarvisRecurringPatterns();
  const summary = getJarvisMemorySummary();
  const evo = getEvolutiveMemoryEvents(12);
  const disc = u.jarvisOperador?.opportunityDiscovery?.oportunidades || [];
  const dormidas = Array.isArray(disc)
    ? disc.filter((x) => x && /dormid|sin gest|72h|estanc/i.test(String(x.titulo || x.accionSugerida || '')))
    : [];

  /** @type {string[]} */
  const lineas = [];

  for (const t of patterns.textoPatrones || []) {
    lineas.push(t);
  }
  for (const c of patterns.cuellosRepetidos || []) {
    lineas.push(`Freno repetido (${c.veces}×): ${c.frase}`);
  }
  for (const cl of (patterns.topClientesRiesgo || []).slice(0, 2)) {
    lineas.push(`Cliente activo en briefs recurrentes: ${cl.cliente} · ${cl.apariciones} apariciones.`);
  }
  if (dormidas.length) {
    lineas.push(`Oportunidades dormidas detectadas en motor: ${dormidas.length} ítem(es) con señal de estancamiento.`);
  }
  const zonas = u.jarvisExpansionRadar?.zonas || [];
  if (zonas.length) {
    lineas.push(`Zonas subexplotadas en radar: ${zonas.slice(0, 3).map((z) => z.comuna).filter(Boolean).join(', ') || '—'}.`);
  }
  for (const e of evo.slice(0, 4)) {
    const d = String(e.tipo || e.payload?.archivos || e.payload?.canal || '').slice(0, 120);
    if (d) lineas.push(`Evolución reciente: ${d}`);
  }
  if (summary.muestrasBloqueos?.length) {
    const b = summary.muestrasBloqueos[0];
    lineas.push(`Último bloqueo registrado en memoria: ${String(b.texto || '').slice(0, 100)}`);
  }

  if (!lineas.length) {
    lineas.push(
      'Memoria en calibración: cada ingesta y cada recálculo alimentan patrones. Cargá correo, OT o vault para densidad.'
    );
  }

  return {
    version: JARVIS_MEMORIA_EVOLUTIVA_VERSION,
    computedAt: new Date().toISOString(),
    lineas: lineas.slice(0, 10),
  };
}
