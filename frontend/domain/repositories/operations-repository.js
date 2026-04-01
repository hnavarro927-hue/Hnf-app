/**
 * Repositorio Operación — OT y flujo local (`hnf.ot.flow.v1` vía hnf-ot-flow-storage).
 * Capa única para Kanban, ingesta y persistencia operativa; backend puede reemplazar implementación.
 */

export {
  getAllOTs,
  saveOT,
  updateOT,
  persistEstadoOperativo,
  createOtFromIntakeFlow,
} from '../ot-repository.js';

export { loadFlowStore, saveFlowStore } from '../hnf-ot-flow-storage.js';

export const OPS_FLOW_STORAGE_HINT = 'hnf.ot.flow.v1';
