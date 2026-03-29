import { hnfOperativoIntegradoService } from '../services/hnfOperativoIntegrado.service.js';
import { assertAction } from '../utils/rbacHttp.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

const gate = (req, res) => assertAction(req, res, 'hnfcore.access');

export const getValidationQueue = async (request, response) => {
  if (!gate(request, response)) return;
  const data = await hnfOperativoIntegradoService.listValidationQueue();
  sendSuccess(response, 200, data, { resource: 'hnf-core/validation-queue' });
};

export const postValidationQueue = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.createValidationItem(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'hnf-core/validation-queue', action: 'create' });
};

export const patchValidationQueue = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.patchValidationItem(
    request.params?.id,
    request.body || {},
    actor
  );
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  if (r.error) {
    const st = r.code === 'NOT_FOUND' ? 404 : r.code === 'USE_CONFIRM' ? 422 : 422;
    return sendError(response, st, r.error, { code: r.code });
  }
  sendSuccess(response, 200, r, { resource: 'hnf-core/validation-queue', action: 'patch' });
};

export const postValidationConfirm = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.confirmValidationItem(request.params?.id, actor);
  if (r.error) {
    const st = r.code === 'NOT_FOUND' ? 404 : 422;
    return sendError(response, st, r.error, { code: r.code });
  }
  sendSuccess(response, 200, r, { resource: 'hnf-core/validation-queue', action: 'confirm' });
};

export const postCargaMasiva = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.bulkIngest(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'hnf-core/carga-masiva', action: 'create' });
};

export const getValidatedMemory = async (request, response) => {
  if (!gate(request, response)) return;
  const data = await hnfOperativoIntegradoService.listValidatedMemory();
  sendSuccess(response, 200, data, { resource: 'hnf-core/validated-memory' });
};

export const getExtendedClients = async (request, response) => {
  if (!gate(request, response)) return;
  const data = await hnfOperativoIntegradoService.listExtendedClients();
  sendSuccess(response, 200, data, { resource: 'hnf-core/extended-clients' });
};

export const postExtendedClient = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.createExtendedClient(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'hnf-core/extended-clients', action: 'create' });
};

export const patchExtendedClient = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.patchExtendedClient(
    request.params?.id,
    request.body || {},
    actor
  );
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'hnf-core/extended-clients', action: 'patch' });
};

export const getInternalDirectory = async (request, response) => {
  if (!gate(request, response)) return;
  const data = await hnfOperativoIntegradoService.listInternalDirectory();
  sendSuccess(response, 200, data, { resource: 'hnf-core/internal-directory' });
};

export const postInternalDirectory = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.createInternalDirectory(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'hnf-core/internal-directory', action: 'create' });
};

export const patchInternalDirectory = async (request, response) => {
  if (!gate(request, response)) return;
  const actor = getRequestActor(request);
  const r = await hnfOperativoIntegradoService.patchInternalDirectory(
    request.params?.id,
    request.body || {},
    actor
  );
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'hnf-core/internal-directory', action: 'patch' });
};
