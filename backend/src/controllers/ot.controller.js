import { otModel } from '../models/ot.model.js';
import { otService } from '../services/ot.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

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
  const item = await otService.create(request.body || {});

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
  const result = await otService.updateStatus(
    request.params.id,
    request.body?.estado,
    otModel.statusOptions
  );

  if (result.error) {
    const isEvidenceBlock = result.code === 'EVIDENCE_INCOMPLETE';
    return sendError(response, isEvidenceBlock ? 422 : 400, result.error, {
      resource: 'ots',
      validStatuses: otModel.statusOptions,
    });
  }

  return sendSuccess(response, 200, result, {
    resource: 'ots',
    action: 'updateOTStatus',
  });
};

export const patchOTEvidences = async (request, response) => {
  const result = await otService.appendEvidences(request.params.id, request.body || {});

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
  const result = await otService.updateEquipos(request.params.id, request.body || {});

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
  const result = await otService.updateReport(request.params.id, request.body || {});

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
