import {
  getOcCabeceraDetalle,
  getOcCabeceras,
  patchOcCabecera,
  patchOcDetalle,
  postOcUploadPdf,
  postOcValidar,
} from '../controllers/ocPurchaseOrder.controller.js';

export const ocPurchaseOrderRoutes = [
  { method: 'GET', path: '/documentos-oc', handler: getOcCabeceras },
  { method: 'POST', path: '/documentos-oc/carga/pdf', handler: postOcUploadPdf },
  { method: 'GET', path: '/documentos-oc/:id', handler: getOcCabeceraDetalle },
  { method: 'PATCH', path: '/documentos-oc/:id/cabecera', handler: patchOcCabecera },
  { method: 'PATCH', path: '/documentos-oc/detalle/:detalleId', handler: patchOcDetalle },
  { method: 'POST', path: '/documentos-oc/:id/validar', handler: postOcValidar },
];
