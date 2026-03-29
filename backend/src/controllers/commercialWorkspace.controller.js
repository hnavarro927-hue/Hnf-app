import { commercialWorkspaceService } from '../services/commercialWorkspace.service.js';
import { auditService } from '../services/audit.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { assertAction } from '../utils/rbacHttp.js';

export const getCommercialPropuestas = async (request, response) => {
  const ctx = assertAction(request, response, 'commercial.propuesta.write');
  if (!ctx) return;
  const data = await commercialWorkspaceService.listPropuestas();
  sendSuccess(response, 200, data, { resource: 'commercial/propuestas' });
};

export const getCommercialBorradoresCorreo = async (request, response) => {
  const ctx = assertAction(request, response, 'commercial.borrador.write');
  if (!ctx) return;
  const data = await commercialWorkspaceService.listBorradoresCorreo();
  sendSuccess(response, 200, data, { resource: 'commercial/borradores-correo' });
};

export const postCommercialPropuesta = async (request, response) => {
  const body = request.body || {};
  const tipo = String(body.tipo || '').toLowerCase();
  const act = tipo === 'borrador_correo_jarvis' ? 'commercial.borrador.write' : 'commercial.propuesta.write';
  const ctx = assertAction(request, response, act);
  if (!ctx) return;
  const r = await commercialWorkspaceService.create(body, ctx.actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  await auditService.logCritical({
    actor: ctx.actor,
    action: 'commercial.propuesta.create',
    resource: 'commercial/propuestas',
    resourceId: r.entry?.id,
    meta: { tipo: r.entry?.tipo },
    result: 'ok',
  });
  sendSuccess(response, 201, r.entry, { resource: 'commercial/propuestas', action: 'create' });
};

export const postCommercialBorradorJarvis = async (request, response) => {
  const ctx = assertAction(request, response, 'commercial.borrador.write');
  if (!ctx) return;
  const r = await commercialWorkspaceService.upsertBorradorJarvis(request.body || {}, ctx.actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  await auditService.logCritical({
    actor: ctx.actor,
    action: 'commercial.borrador.jarvis',
    resource: 'commercial/borradores-correo',
    resourceId: r.entry?.id,
    result: 'ok',
  });
  sendSuccess(response, 201, r.entry, { resource: 'commercial/borradores-correo', action: 'create' });
};

export const patchCommercialPropuesta = async (request, response) => {
  const ctx = assertAction(request, response, 'commercial.propuesta.write');
  if (!ctx) return;
  const r = await commercialWorkspaceService.patch(request.params?.id, request.body || {}, ctx.actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r.entry, { resource: 'commercial/propuestas', action: 'patch' });
};
