/**
 * Jarvis Self-Healing — diagnóstico y sugerencias; no ejecuta cambios automáticos.
 */

export const JARVIS_SELF_HEALING_VERSION = '2026-03-24';

/**
 * @typedef {object} SelfHealingItem
 * @property {string} tipoError
 * @property {string} impacto
 * @property {string} accionSugerida
 * @property {number} prioridad - 1 = más urgente
 */

/**
 * @param {object} unified
 * @param {object} viewData
 * @param {object} runtimeSnap
 * @returns {{ version: string, items: SelfHealingItem[] }}
 */
export function runJarvisSelfHealing(unified, viewData = {}, runtimeSnap = {}) {
  const u = unified || {};
  const vd = viewData || {};
  const ctrl = u.jarvisControl || {};
  const toggles = ctrl.jarvisToggles || {};
  /** @type {SelfHealingItem[]} */
  const items = [];

  const planOts = u.planOts ?? vd.planOts ?? vd.ots?.data ?? [];
  const msgs = u.outlookFeed?.messages ?? vd.outlookFeed?.messages ?? [];
  const opps = u.commercialOpportunities ?? [];

  if (toggles.ingestCurrentData && (!Array.isArray(planOts) || planOts.length === 0)) {
    items.push({
      tipoError: 'datos_vacios_criticos',
      impacto: 'Sin OT no hay flujo ni economía operativa en Jarvis.',
      accionSugerida: 'Verificar API /ots, conexión y que la vista haya cargado datos completos.',
      prioridad: 1,
    });
  }

  if (toggles.ingestOutlook && (!Array.isArray(msgs) || msgs.length === 0)) {
    items.push({
      tipoError: 'correo_no_visible',
      impacto: 'Seguimiento interno Romina/Gery/Lyn queda ciego.',
      accionSugerida: 'Revisar feed Outlook (intake) y toggles del centro de control.',
      prioridad: 2,
    });
  }

  if (toggles.ingestCommercial && Array.isArray(opps) && opps.length === 0) {
    items.push({
      tipoError: 'pipeline_comercial_vacio',
      impacto: 'Inteligencia comercial no puede priorizar oportunidades.',
      accionSugerida: 'Confirmar carga de oportunidades o desactivar toggle si es intencional.',
      prioridad: 3,
    });
  }

  const pulse = runtimeSnap.pulse;
  if (pulse?.running && pulse.lastCycleAt && pulse.intervalMs) {
    const staleMs = Date.now() - pulse.lastCycleAt;
    if (staleMs > Math.max(pulse.intervalMs * 4, 120000)) {
      items.push({
        tipoError: 'loop_pulse_posiblemente_roto',
        impacto: 'Pulse declarado activo pero sin ciclos recientes.',
        accionSugerida: 'Pausar y reiniciar Pulse; revisar consola por errores en idle callback.',
        prioridad: 2,
      });
    }
  }

  const ring = runtimeSnap.errorRing || [];
  if (ring.length >= 3) {
    const last3 = ring.slice(-3);
    const same = last3.every((e) => e.message === last3[0].message);
    if (same) {
      items.push({
        tipoError: 'error_repetitivo',
        impacto: 'Mismo fallo en ciclos consecutivos — posible condición no manejada.',
        accionSugerida: `Registrar y corregir causa raíz: "${String(last3[0].message).slice(0, 120)}".`,
        prioridad: 1,
      });
    }
  }

  if (pulse?.lastError) {
    items.push({
      tipoError: 'ultimo_fallo_pulse',
      impacto: 'El último ciclo Pulse registró excepción.',
      accionSugerida: `Revisar traza y datos de entrada: ${String(pulse.lastError).slice(0, 160)}`,
      prioridad: 2,
    });
  }

  const failures = u.autonomicState?.internalFailures || [];
  if (Array.isArray(failures) && failures.length > 4) {
    items.push({
      tipoError: 'autonomic_failures_altos',
      impacto: 'MAPE detecta múltiples fallas internas simultáneas.',
      accionSugerida: 'Revisar monitor MAPE y reducir ruido (fuentes desalineadas o toggles contradictorios).',
      prioridad: 3,
    });
  }

  items.sort((a, b) => a.prioridad - b.prioridad);

  return { version: JARVIS_SELF_HEALING_VERSION, items };
}
