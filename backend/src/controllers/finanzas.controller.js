import { cierreMensualService } from '../services/cierreMensual.service.js';
import { tiendaFinancieraService } from '../services/tiendaFinanciera.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const getTiendasFinancieras = async (_request, response) => {
  const data = await tiendaFinancieraService.list();
  sendSuccess(response, 200, data, { resource: 'finanzas/tiendas' });
};

export const postTiendaFinanciera = async (request, response) => {
  const actor = getRequestActor(request);
  const row = await tiendaFinancieraService.create(request.body || {}, actor);
  sendSuccess(response, 201, row, { resource: 'finanzas/tiendas', action: 'create' });
};

export const patchTiendaFinanciera = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await tiendaFinancieraService.update(request.params?.id, request.body || {}, actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'finanzas/tiendas', action: 'patch' });
};

export const getCierresMensuales = async (_request, response) => {
  const data = await cierreMensualService.listCierres();
  sendSuccess(response, 200, data, { resource: 'finanzas/cierres-mensuales' });
};

export const getCierreMensual = async (request, response) => {
  const r = await cierreMensualService.getCierre(request.params?.id);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'finanzas/cierres-mensuales' });
};

const periodoFromRequest = (request) => {
  try {
    const u = new URL(request.url || '', 'http://localhost');
    return u.searchParams.get('periodo') || u.searchParams.get('period') || '';
  } catch {
    return '';
  }
};

export const getCandidatasCierre = async (request, response) => {
  const periodo = periodoFromRequest(request);
  const r = await cierreMensualService.candidatasPeriodo(periodo);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 200, r, { resource: 'finanzas/cierres-mensuales', action: 'candidatas' });
};

export const postCierreMensual = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await cierreMensualService.crearCierre(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'finanzas/cierres-mensuales', action: 'create' });
};

export const postCierreIncluirOt = async (request, response) => {
  const actor = getRequestActor(request);
  const otId = String(request.body?.ot_id || request.body?.otId || '').trim();
  if (!otId) return sendError(response, 400, 'ot_id obligatorio');
  const r = await cierreMensualService.incluirOt(request.params?.id, otId, actor);
  if (r.error) return sendError(response, 404, r.error);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 200, r, { resource: 'finanzas/cierres-mensuales', action: 'incluir_ot' });
};

export const postCierreExcluirOt = async (request, response) => {
  const actor = getRequestActor(request);
  const otId = String(request.body?.ot_id || request.body?.otId || '').trim();
  if (!otId) return sendError(response, 400, 'ot_id obligatorio');
  const r = await cierreMensualService.excluirOt(request.params?.id, otId, actor);
  if (r.error) return sendError(response, 404, r.error);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 200, r, { resource: 'finanzas/cierres-mensuales', action: 'excluir_ot' });
};

export const postCierreCerrar = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await cierreMensualService.cerrarPeriodo(request.params?.id, actor);
  if (r.error) return sendError(response, 404, r.error);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 200, r, { resource: 'finanzas/cierres-mensuales', action: 'cerrar' });
};

export const postCierreMarcarFacturado = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await cierreMensualService.marcarFacturado(request.params?.id, actor);
  if (r.error) return sendError(response, 404, r.error);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 200, r, { resource: 'finanzas/cierres-mensuales', action: 'marcar_facturado' });
};
