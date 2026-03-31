import { useCallback, useMemo } from 'react';
import {
  alertaOperativaVisual,
  asignacionOperativaDesdeTipoServicio,
  backendRolPuedeVerTipoServicioOt,
  filtrarOtsPorRolBackend,
  jarvisOperativaPuedeEjecutar,
  jarvisPipelineSugerenciasOperativas,
  jarvisSugerirPrioridadOperativa,
} from '../domain/hnf-operativa-reglas.js';

/**
 * Hook para vistas React (p. ej. Centro de control): filtro por rol, alertas, helpers Jarvis.
 * @param {object} params
 * @param {object[]} [params.ots]
 * @param {string} [params.rolBackend] — de getSessionBackendRole() en shell HNF
 * @param {{ diasAtrasoIngreso?: number, diasAtrasoPendienteLyn?: number, referenciaLynIso?: string }} [params.alertaAtrasoOpts]
 */
export function useOperativaReglas({ ots = [], rolBackend = '', alertaAtrasoOpts = {} } = {}) {
  const otsFiltrados = useMemo(
    () => (rolBackend ? filtrarOtsPorRolBackend(ots, rolBackend) : ots),
    [ots, rolBackend]
  );

  const alertaParaOt = useCallback(
    (ot) => alertaOperativaVisual(ot, alertaAtrasoOpts),
    [alertaAtrasoOpts]
  );

  const asignacionParaTipo = useCallback((tipo) => asignacionOperativaDesdeTipoServicio(tipo), []);

  const puedeVerTipo = useCallback((tipo) => backendRolPuedeVerTipoServicioOt(rolBackend, tipo), [rolBackend]);

  const jarvisPuede = useCallback((accionId) => jarvisOperativaPuedeEjecutar(accionId), []);

  const jarvisPrioridad = useCallback((ot) => jarvisSugerirPrioridadOperativa(ot), []);

  const jarvisPipeline = useCallback((borrador) => jarvisPipelineSugerenciasOperativas(borrador), []);

  return {
    otsFiltrados,
    alertaParaOt,
    asignacionParaTipo,
    puedeVerTipo,
    jarvisPuede,
    jarvisPrioridad,
    jarvisPipeline,
  };
}
