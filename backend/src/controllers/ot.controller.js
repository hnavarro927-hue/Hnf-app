import { otModel } from '../models/ot.model.js';
import { otService } from '../services/ot.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';
import { assertAction } from '../utils/rbacHttp.js';

export const getAllOT = async (request, response) => {
  const data = await otService.getAll();
  sendSuccess(response, 200, data, {
    resource: 'ots',
    flow: ['crear OT', 'cambiar estado', 'obtener lista de OT'],
    model: otModel,
    repositoryMode: otService.repositoryMode,
  });
};

export const getOTById = async (request, response) => {
  const item = await otService.getById(request.params.id);
  if (!item) {
    return sendError(response, 404, 'OT no encontrada.', { resource: 'ots' });
  }
  sendSuccess(response, 200, item, { resource: 'ots', action: 'getOne' });
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
      result.code === 'ECONOMICS_INCOMPLETE' ||
      result.code === 'NO_RESPONSABLE';
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

export const patchOTCore = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.patchCore(request.params.id, request.body || {}, actor);

  if (result.errors) {
    return sendError(response, 400, 'Edición de OT inválida.', {
      resource: 'ots',
      validations: result.errors,
    });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'patchOTCore',
  });
};

export const postEnviarCliente = async (request, response) => {
  if (!assertAction(request, response, 'ot.enviar_cliente')) return;
  const actor = request.hnfActor || getRequestActor(request);
  const result = await otService.enviarInformeClienteSimulado(request.params.id, actor);

  if (result.error) {
    const code = result.code;
    const status =
      code === 'NOT_FOUND'
        ? 404
        : code === 'ALREADY_SENT'
          ? 409
          : 422;
    return sendError(response, status, result.error, {
      resource: 'ots',
      code: code || 'ENVIO_CLIENTE',
    });
  }

  return sendSuccess(response, 200, result.ot, {
    resource: 'ots',
    action: 'envio_cliente',
  });
};

export const deleteOT = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await otService.deleteById(request.params.id, actor);

  if (result.code === 'FORBIDDEN') {
    return sendError(response, 403, result.error, { resource: 'ots', code: result.code });
  }

  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'ots' });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'deleteOT',
  });
};
