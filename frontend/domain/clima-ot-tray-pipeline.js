import { getSessionBackendRole } from '../config/session-bridge.js';
import { filtrarOtsPorRolBackend } from './hnf-operativa-reglas.js';
import { filterOtsIntelList } from './clima-ot-intel-filters.js';

/**
 * Misma canalización que la bandeja Clima: servidor → rol → filtro intel.
 * @param {{ data?: unknown[] } | null | undefined} viewData
 * @param {Record<string, unknown> | null | undefined} intelListFilter
 */
export function buildClimaTrayPipeline(viewData, intelListFilter) {
  let ots = [...(viewData?.data || [])].reverse();
  const br = getSessionBackendRole() || 'admin';
  ots = filtrarOtsPorRolBackend(ots, br);
  if (String(br || '').toLowerCase() === 'gery') {
    ots = [];
  }
  const listOts = filterOtsIntelList(ots, intelListFilter);
  return { ots, listOts, br };
}
