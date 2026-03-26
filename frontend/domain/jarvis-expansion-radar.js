/**
 * Radar de expansión — heurística local sobre estado unificado (sin APIs externas).
 */

export const JARVIS_EXPANSION_RADAR_VERSION = '2026-03-23';

/**
 * @param {object} unified - getJarvisUnifiedState
 */
export function buildJarvisExpansionRadar(unified) {
  const u = unified || {};
  const comm = u.jarvisCommercialIntelAdvanced || {};
  const zonas = Array.isArray(comm.zonasSubexplotadas) ? comm.zonasSubexplotadas.slice(0, 6) : [];
  const hot = Array.isArray(comm.oportunidadesCalientes) ? comm.oportunidadesCalientes.slice(0, 5) : [];
  const disc = u.jarvisOperador?.opportunityDiscovery?.oportunidades || [];
  const recurrentes = Array.isArray(disc)
    ? disc.filter((x) => x && (x.tipo === 'contrato_recurrencia' || /recurr|mensual|contrato/i.test(String(x.titulo || x.accionSugerida || ''))))
    : [];
  const recurrentesSlice = recurrentes.slice(0, 5);

  /** @type {string[]} */
  const lineas = [];
  for (const z of zonas.slice(0, 4)) {
    if (z?.comuna) {
      lineas.push(
        `Zona subexplotada: ${z.comuna}${z.totalOt != null ? ` · ${z.totalOt} OT` : ''}${z.ratioCierre != null ? ` · cierre ${z.ratioCierre}%` : ''}`
      );
    }
  }
  for (const h of hot) {
    const m = Math.round(Number(h.estimacionMonto || h.monto || 0) || 0);
    lineas.push(`Cliente potencial caliente: ${h.cliente || '—'}${m ? ` ~$${m.toLocaleString('es-CL')}` : ''}`);
  }
  for (const r of recurrentesSlice) {
    lineas.push(r.accionSugerida || r.titulo || 'Contrato / recurrencia detectada en motor de oportunidades.');
  }
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const dormidos = opps.filter((o) => String(o.estado || '').toLowerCase() === 'pendiente').length;
  if (dormidos >= 3) {
    lineas.push(`${dormidos} oportunidad(es) en estado pendiente — revisar cuáles están dormidas sin gestión.`);
  }

  if (!lineas.length) {
    lineas.push('Sin señales de expansión densas en este corte — alimentar comercial + vault para calibrar radar.');
  }

  return {
    version: JARVIS_EXPANSION_RADAR_VERSION,
    computedAt: new Date().toISOString(),
    zonas,
    clientesPotencial: hot,
    contratosRecurrentes: recurrentesSlice,
    lineas: lineas.slice(0, 12),
  };
}
