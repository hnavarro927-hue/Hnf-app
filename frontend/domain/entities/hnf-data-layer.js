/**
 * Capas funcionales HNF Servicios Integrales y formas de datos maestros / operación.
 * Sin pretender ERP: contratos mínimos para API futura y localStorage ordenado.
 *
 * @typedef {'gerencia' | 'operacion' | 'control_gerencial'} HnfFunctionalLayer
 *
 * @typedef {Object} HnfClient
 * @property {string} id
 * @property {string} [nombre]
 * @property {string} [rut]
 * @property {string} [correo]
 * @property {string} [estado]
 *
 * @typedef {Object} HnfClientContact
 * @property {string} id
 * @property {string} clientId
 * @property {string} [nombre]
 * @property {string} [email]
 * @property {string} [rol] — ej. tienda, casa matriz
 *
 * @typedef {Object} HnfBranchOrStore
 * @property {string} id
 * @property {string} clientId
 * @property {string} [nombre]
 * @property {string} [tipoTienda] — outlet | store | casa_matriz
 * @property {string} [region]
 * @property {string} [zona]
 * @property {string} [ciudad]
 * @property {string} [maintenanceFrequencyId]
 *
 * @typedef {Object} HnfContract
 * @property {string} id
 * @property {string} clientId
 * @property {string} [nombre]
 * @property {string} [vigenteDesde]
 * @property {string} [vigenteHasta]
 *
 * @typedef {Object} HnfMaintenanceFrequency
 * @property {string} id
 * @property {string} [label] — ej. bimensual, trimestral
 * @property {number} [monthsBetween]
 *
 * @typedef {Object} HnfAssetOrEquipment
 * @property {string} id
 * @property {string} [branchId]
 * @property {string} [clientId]
 * @property {string} [tipo]
 * @property {number} [cantidad]
 *
 * @typedef {Object} HnfEmployee
 * @property {string} id
 * @property {string} [nombre]
 * @property {string} [email]
 * @property {string[]} [roleIds]
 *
 * @typedef {Object} HnfRole
 * @property {string} id
 * @property {string} label
 *
 * @typedef {Object} HnfServiceCatalogItem
 * @property {string} id
 * @property {string} label
 * @property {string} [area] — clima | flota
 *
 * @typedef {Object} HnfPricingCatalogItem
 * @property {string} id
 * @property {string} [concepto]
 * @property {number} [valorReferencia]
 * @property {string} [moneda]
 *
 * @typedef {Object} HnfWorkOrder
 * @property {string} id
 * @property {string} [clienteId]
 * @property {string} [estadoOperativo]
 *
 * @typedef {Object} HnfWorkOrderStatusEvent
 * @property {string} at
 * @property {string} estado
 * @property {string} [detalle]
 *
 * @typedef {Object} HnfExpense
 * @property {string} id
 * @property {number} monto
 * @property {string} [workOrderId]
 *
 * @typedef {Object} HnfApproval
 * @property {string} id
 * @property {string} [workOrderId]
 * @property {string} estado
 *
 * @typedef {Object} HnfScheduleSlot
 * @property {string} id
 * @property {string} [workOrderId]
 * @property {string} [inicio]
 *
 * @typedef {Object} HnfEvidenceFile
 * @property {string} id
 * @property {string} [workOrderId]
 * @property {string} [url]
 */

export const HNF_FUNCTIONAL_LAYERS = {
  BASE_MAESTRA: 'base_maestra',
  OPERACION: 'operacion',
  CONTROL_GERENCIAL: 'control_gerencial',
};
