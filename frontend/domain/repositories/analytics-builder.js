/**
 * Analytics / KPIs ejecutivos leyendo la misma fuente que Mando OT (operations-repository).
 */

import { getAllOTs } from './operations-repository.js';
import { buildOtOperationalKpis } from '../hnf-ot-state-engine.js';

/**
 * @param {object[]} planOtsRaw — típicamente plan desde API / data loader
 */
export function buildOperationalAnalytics(planOtsRaw) {
  const list = getAllOTs(planOtsRaw);
  return buildOtOperationalKpis(list);
}

/** Cuando ya aplicaste filtros de rol y merge (`getAllOTs` + filtrar). */
export function buildOperationalKpisFromMergedList(mergedOts) {
  return buildOtOperationalKpis(Array.isArray(mergedOts) ? mergedOts : []);
}
