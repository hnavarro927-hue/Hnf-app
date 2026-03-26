/**
 * Presión operativa — sube urgencia cuando el sistema está flojo o ciego.
 */

export const JARVIS_URGENCY_VERSION = '2026-03-22';

const order = { baja: 0, media: 1, alta: 2, critica: 3 };

const bump = (current, next) => (order[next] > order[current] ? next : current);

/**
 * @param {object} unified
 * @param {object} ctx
 * @param {object} ctx.moneyLeaks
 * @param {object} [ctx.flowIntel]
 * @param {number} [ctx.opportunityDiscoveryCount]
 * @param {object} [ctx.reality]
 * @param {object} [ctx.hiddenErrors]
 */
export function runUrgencyEngine(unified, ctx = {}) {
  const u = unified || {};
  const ml = ctx.moneyLeaks || {};
  const fi = ctx.flowIntel || u.jarvisFlowIntelligence || {};
  const flow = fi.flowState || {};
  const econ = fi.economicState || {};
  const meta = flow._meta || {};
  const reality = ctx.reality || {};
  const hidden = ctx.hiddenErrors || { items: [] };

  let nivel = ml.urgencia && order[ml.urgencia] != null ? ml.urgencia : 'media';

  if (flow.ritmo === 'bajo') nivel = bump(nivel, 'alta');
  if (reality.jarvisModo === 'inferencial') nivel = bump(nivel, 'alta');
  if ((ctx.opportunityDiscoveryCount || 0) >= 4 && (u.commercialOpportunities || []).length === 0) {
    nivel = bump(nivel, 'alta');
  }

  const critH = hidden.items?.filter((i) => i.severidad === 'critical').length || 0;
  if (critH >= 2) nivel = bump(nivel, 'critica');
  else if (critH === 1) nivel = bump(nivel, 'alta');

  const backlog = meta.hiddenBacklogCount || 0;
  if (backlog >= 5) nivel = bump(nivel, 'alta');
  if (backlog >= 8 || (flow.inactividadCritica && backlog >= 3)) nivel = bump(nivel, 'critica');

  const ib = Number(ml.ingresoBloqueado ?? econ.ingresoBloqueado ?? 0);
  if (ib >= 600_000) nivel = bump(nivel, 'critica');
  else if (ib >= 320_000) nivel = bump(nivel, 'alta');

  /** @type {string[]} */
  const razones = [];
  if (flow.ritmo === 'bajo') razones.push('ritmo_operativo_bajo');
  if (reality.jarvisModo === 'inferencial') razones.push('modo_inferencial');
  if (!(u.commercialOpportunities || []).length) razones.push('pipeline_visible_vacio');
  if (backlog >= 5) razones.push('backlog_oculto_alto');
  if (critH) razones.push('errores_criticos');

  return {
    version: JARVIS_URGENCY_VERSION,
    nivel,
    razones,
  };
}
