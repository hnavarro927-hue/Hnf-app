import { ocPurchaseOrderService } from '../services/ocPurchaseOrder.service.js';
import { auditService } from '../services/audit.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { assertAction } from '../utils/rbacHttp.js';

export const getOcCabeceras = async (request, response) => {
  const ctx = assertAction(request, response, 'oc.patch');
  if (!ctx) return;
  const data = await ocPurchaseOrderService.listCabeceras();
  sendSuccess(response, 200, data, { resource: 'documentos-oc' });
};

export const getOcCabeceraDetalle = async (request, response) => {
  const ctx = assertAction(request, response, 'oc.patch');
  if (!ctx) return;
  const r = await ocPurchaseOrderService.getCabeceraConDetalle(request.params?.id);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'documentos-oc' });
};

export const postOcUploadPdf = async (request, response) => {
  const ctx = assertAction(request, response, 'oc.upload');
  if (!ctx) return;
  const r = await ocPurchaseOrderService.uploadPdfBase64(request.body || {}, ctx.actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  await auditService.logCritical({
    actor: ctx.actor,
    action: 'oc.upload',
    resource: 'documentos-oc',
    resourceId: r.cabecera?.id,
    meta: { numeroOc: r.cabecera?.numeroOc, estado: r.cabecera?.estadoExtraccion },
    result: 'ok',
  });
  sendSuccess(response, 201, r, { resource: 'documentos-oc', action: 'upload' });
};

export const patchOcCabecera = async (request, response) => {
  const ctx = assertAction(request, response, 'oc.patch');
  if (!ctx) return;
  const r = await ocPurchaseOrderService.patchCabecera(request.params?.id, request.body || {}, ctx.actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'documentos-oc', action: 'patch_cabecera' });
};

export const patchOcDetalle = async (request, response) => {
  const ctx = assertAction(request, response, 'oc.patch');
  if (!ctx) return;
  const r = await ocPurchaseOrderService.patchDetalle(request.params?.id, request.body || {}, ctx.actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'documentos-oc', action: 'patch_detalle' });
};

export const postOcValidar = async (request, response) => {
  const ctx = assertAction(request, response, 'oc.validate');
  if (!ctx) return;
  const r = await ocPurchaseOrderService.validarCabecera(request.params?.id, ctx.actor);
  if (r.error) return sendError(response, 404, r.error);
  if (r.errors) return sendError(response, 400, 'No se puede validar', { validations: r.errors });
  await auditService.logCritical({
    actor: ctx.actor,
    action: 'oc.validate',
    resource: 'documentos-oc',
    resourceId: request.params?.id,
    meta: { totalValidado: r.cabecera?.totalValidado },
    result: 'ok',
  });
  sendSuccess(response, 200, r, { resource: 'documentos-oc', action: 'validar' });
};
