/**
 * =============================================================================
 * HNF — CONTRATO ARQUITECTÓNICO (backend, espejo del frontend)
 * =============================================================================
 *
 * Persistencia actual: principalmente JSON bajo `backend/data/` vía repositorios.
 * API unificada: `src/routes/index.js` ensambla rutas REST.
 *
 * Dominios expuestos (oficial vía HTTP):
 * - health, responsibility, ots, clients, vehicles, expenses
 * - planificación: clientes, tiendas, mantenciones
 * - operational-calendar, technical-documents, commercial-opportunities
 * - flota solicitudes, whatsapp feed, outlook intake, historical-vault
 * - jarvis-operative-events
 *
 * Pendiente evolutivo (no improvisar sin diseño):
 * - RBAC / roles server-side
 * - Auditoría de aprobaciones multi-usuario
 * - Facturación / cierre contable unificado
 * - Sustitución de fallback memoria por Mongo cuando aplique
 */

export const HNF_BACKEND_ARCHITECTURE_VERSION = '2026-03-24.2';

export const HNF_BACKEND_DATA_OFFICIAL = Object.freeze({
  pattern: 'backend/data/*.json vía repositories + controllers',
  note: 'Hasta migración DB, este es el almacén operativo de desarrollo/piloto',
});
