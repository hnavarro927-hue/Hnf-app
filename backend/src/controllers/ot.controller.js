import { otModel } from '../models/ot.model.js';
import { otService } from '../services/ot.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const getAllOT = async (request, response) => {
  const data = await otService.getAll();
  sendSuccess(response, 200, data, {
    resource: 'ots',
    flow: ['crear OT', 'cambiar estado', 'obtener lista de OT'],
    model: otModel,
    repositoryMode: otService.repositoryMode,
  });
};

export const createOT = async (request, response) => {
  const actor = getRequestActor(request);
  const item = await otService.create(request.body || {}, actor);

  if (item.errors) {
    return sendError(response, 400, 'Payload de OT inválido.', {
      resource: 'ots',
      validations: item.errors,
    });
  }

  sendSuccess(response, 201, item, {
    resource: 'ots',
    action: 'createOT',
  });
};

export const updateOTStatus = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.updateStatus(
    request.params.id,
    request.body?.estado,
    otModel.statusOptions,
    actor
  );

  if (result.error) {
    const isCloseBlock =
      result.code === 'EVIDENCE_INCOMPLETE' ||
      result.code === 'QUALITY_INCOMPLETE' ||
      result.code === 'ECONOMICS_INCOMPLETE';
    return sendError(response, isCloseBlock ? 422 : 400, result.error, {
      resource: 'ots',
      validStatuses: otModel.statusOptions,
      code: result.code,
    });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'updateOTStatus',
  });
};

export const patchOTEvidences = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.appendEvidences(request.params.id, request.body || {}, actor);

  if (result.errors) {
    return sendError(response, 400, 'Payload de evidencias inválido.', {
      resource: 'ots',
      validations: result.errors,
    });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'patchOTEvidences',
  });
};

export const patchOTEquipos = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.updateEquipos(request.params.id, request.body || {}, actor);

  if (result.errors) {
    return sendError(response, 400, 'Payload de equipos inválido.', {
      resource: 'ots',
      validations: result.errors,
    });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'patchOTEquipos',
  });
};

export const patchOTReport = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.updateReport(request.params.id, request.body || {}, actor);

  if (result.errors) {
    return sendError(response, 400, 'Payload de informe inválido.', {
      resource: 'ots',
      validations: result.errors,
    });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'patchOTReport',
  });
};

export const patchOTVisit = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.patchVisitFields(request.params.id, request.body || {}, actor);

  if (result.errors) {
    return sendError(response, 400, 'Datos de visita inválidos.', {
      resource: 'ots',
      validations: result.errors,
    });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'patchOTVisit',
  });
};

export const patchOTEconomics = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.patchEconomics(request.params.id, request.body || {}, actor);

  if (result.errors) {
    return sendError(response, 400, 'Datos económicos inválidos.', {
      resource: 'ots',
      validations: result.errors,
    });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'patchOTEconomics',
  });
};

export const patchOTOperational = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.patchOperational(request.params.id, request.body || {}, actor);

  if (result.errors) {
    return sendError(response, 400, 'Cambio operativo inválido.', {
      resource: 'ots',
      validations: result.errors,
    });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'patchOTOperational',
  });
};
