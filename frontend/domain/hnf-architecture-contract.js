/**
 * =============================================================================
 * HNF — CONTRATO ARQUITECTÓNICO (fuente única de documentación viva en código)
 * =============================================================================
 *
 * CAUSA RAÍZ ESTRUCTURAL (histórica):
 * La plataforma mezcló rápidamente UI Jarvis, inteligencia en dominio frontend,
 * persistencia local (localStorage) y APIs REST sobre JSON en backend sin un
 * contrato explícito de “qué es oficial”. Eso generó estados duplicados,
 * banners contradictorios y regresiones por variables/refs huérfanas.
 *
 * DIRECCIÓN:
 * - Una sola escritura de `integrationStatus` → solo en `main.js` (estado shell).
 * - Conectividad → solo `probeBackendHealth` + `applyConnectivityFromProbeResult` (main.js).
 * - Vistas → consumen props; no redefinen verdad de red.
 * - Fallo de vista → `main.js` try/catch + fallback; no tumbar shell.
 *
 * -----------------------------------------------------------------------------
 * MAPA DE INFORMACIÓN (qué es qué)
 * -----------------------------------------------------------------------------
 *
 * SOLO MEMORIA (runtime, se pierde al recargar):
 * - `state` en `main.js` (activeView, viewData, integrationStatus, feedback UI).
 * - Contexto de Pulse / timers en `window`.
 *
 * LOCAL (navegador, sobrevive recarga; NO es auditoría corporativa):
 * - Operador: `frontend/config/operator.config.js` (localStorage).
 * - Jarvis centro ingesta / memoria: `jarvis-active-intake-engine.js`, `jarvis-memory.js`,
 *   `jarvis-control-center.js`, `hnf-memory.js`, `hnf-autopilot.js`, `business-memory.js`,
 *   `jarvis-*-memory.js`, `jarvis-infinity-engine.js`, etc.
 * - Toggles / modo Jarvis / canales: `jarvis-control-center.js`, `jarvis-channel-intelligence.js`.
 *
 * BACKEND (oficial operativo mientras dure el contrato JSON + API):
 * - OT, clientes, vehículos, gastos, planificación (clientes/tiendas/mantenciones).
 * - Evidencias e informes asociados a OT (rutas bajo `/ots`).
 * - Documentos técnicos, oportunidades comerciales, calendario operativo.
 * - Feeds simulados / ingesta: WhatsApp, Outlook (recepción), Historical Vault.
 * - Eventos operativos Jarvis, responsibility/tasks (`/api/responsibility`).
 * - Evento operativo HNF unificado: `hnf_operational_events.json` + API `/operational-events`,
 *   panel diario consolidado `GET /operational-panel/daily`, cola raw `hnf_operational_raw_inbox.json`.
 * Ver rutas: `backend/src/routes/index.js`.
 *
 * TEMPORAL UI (no negocio):
 * - Mensajes de feedback, filtros intel, selección OT/flota, banners de guía.
 *
 * OFICIAL (negocio) — hoy:
 * - Persistido vía API que escribe en `backend/data/*.json` (o futuro DB).
 * - No mezclar “oficial” con borradores en localStorage sin marcar explícitamente.
 *
 * DEBERÍA PERSISTIR SERVIDOR Y AÚN NO (o parcial):
 * - Decisiones/aprobaciones Lyn–Hernán–Romina unificadas (base nueva: audit en evento operativo; falta RBAC).
 * - Trazabilidad completa de aprobación de documentos técnicos (workflow parcial en módulos).
 * - Facturación / cierre económico multi-dispositivo (campos OT existen; consolidación fiscal futura).
 * - Roles y permisos (no hay RBAC server-side en núcleo actual).
 *
 * -----------------------------------------------------------------------------
 * FUENTES DE VERDAD (SSOT) — dónde mirar en código
 * -----------------------------------------------------------------------------
 */

export const HNF_ARCHITECTURE_VERSION = '2026-03-24.2';

/** Registro de SSOT: clave → módulo / responsable */
export const HNF_SSOT_REGISTRY = Object.freeze({
  conectividadAppVsApi: {
    module: 'frontend/domain/hnf-connectivity.js',
    api: 'GET /health',
    note: 'probeBackendHealth; shell integrationStatus solo desde applyConnectivityFromProbeResult (main.js)',
  },
  continuidadTecnicaPanel: {
    module: 'frontend/components/hnf-environment-continuity.js',
    api: 'GET /health (misma regla que conectividad)',
    note: 'No usar props integrationStatus para pintar backend caído; runCheck + probe',
  },
  estadoOperativoUi: {
    module: 'frontend/main.js (state)',
    note: 'activeView, viewData, integrationStatus, lastSuccessfulFetchAt',
  },
  evidenciasOt: {
    module: 'backend OT routes + frontend services/ot.service.js',
    note: 'Adjuntos/evidencias ligados a OT en API',
  },
  aprobacionesDocTecnico: {
    module: 'frontend/domain/technical-document-intelligence.js + backend technical-documents',
    note: 'Workflow en evolución; no duplicar estado de aprobación solo en localStorage',
  },
  oportunidadesComerciales: {
    module: 'backend commercial-opportunity + frontend commercial-opportunities.service.js',
    note: 'Lista oficial vía API; alertas pueden ser derivadas en dominio',
  },
  actividadRecienteJarvis: {
    module: 'frontend/domain/jarvis-live-ingestion.js + vista jarvis-hq (flujo vivo)',
    note: 'Digest desde datos unificados; ingesta local complementa pero no reemplaza ERP',
  },
});

/** Modelo de roles — separación conceptual (sin RBAC server aún) */
export const HNF_ROLE_PLANE = Object.freeze({
  ejecutivo: 'Lectura comando, priorización, riesgo agregado (Jarvis HQ / dashboard).',
  supervisionAprobacion: 'Revisión Lyn / criterio técnico-comercial (documentos, cierres).',
  operacionAdministrativa: 'Planificación, clientes/tiendas, administración datos.',
  registroTerreno: 'Clima OT, evidencias, visita, flota en campo.',
});

/** Reglas de resiliencia obligatorias (implementación) */
export const HNF_RESILIENCE = Object.freeze({
  apiSecundariaFalla: 'loadFullOperationalData y cargas por vista usan .catch con defaults; no cambiar integrationStatus.',
  vistaFalla: 'main.js render() try/catch → fallback + Reintentar loadViewData.',
  healthOk: 'Nunca integrationStatus sin conexión sin probe false (ver loadViewData + applyConnectivityFromProbeResult).',
  variableIndefinida: 'Evitar refs en DOM antes de definición; code review + build CI.',
});

/**
 * Ancla el contrato en `window` solo en desarrollo Vite (inspección soporte).
 */
export function registerHnfArchitectureDevHook() {
  try {
    if (typeof window === 'undefined') return;
    if (!import.meta.env?.DEV) return;
    window.__HNF_ARCHITECTURE__ = {
      version: HNF_ARCHITECTURE_VERSION,
      ssot: HNF_SSOT_REGISTRY,
      roles: HNF_ROLE_PLANE,
      resilience: HNF_RESILIENCE,
    };
  } catch {
    /* ignore */
  }
}
