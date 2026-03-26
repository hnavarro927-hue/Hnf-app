import {
  workflowAprobar,
  workflowEnviar,
  workflowObservar,
  workflowRevisar,
} from '../modules/technicalDocuments/technicalDocument.workflow.service.js';
import {
  addDocumentComment,
  addDocumentIngesta,
  createTechnicalDocument,
  getTechnicalDocument,
  listTechnicalDocuments,
  patchTechnicalDocument,
} from '../services/technicalDocument.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const getTechnicalDocuments = async (_request, response) => {
  const data = await listTechnicalDocuments();
  sendSuccess(response, 200, { items: data }, { resource: 'technical_documents' });
};

export const getTechnicalDocumentById = async (request, response) => {
  const id = request.params?.id || '';
  const row = await getTechnicalDocument(id);
  if (!row) return sendError(response, 404, 'Documento no encontrado.', { resource: 'technical_documents' });
  sendSuccess(response, 200, row, { resource: 'technical_documents' });
};

export const postTechnicalDocument = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await createTechnicalDocument(request.body || {}, actor);
  sendSuccess(response, 201, result.entry, { resource: 'technical_documents', action: 'create' });
};

export const patchTechnicalDocumentById = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await patchTechnicalDocument(id, request.body || {}, actor);
  if (result.error) return sendError(response, 400, result.error, { resource: 'technical_documents' });
  sendSuccess(response, 200, result.entry, { resource: 'technical_documents', action: 'patch' });
};

export const postTechnicalDocumentComment = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await addDocumentComment(id, request.body || {}, actor);
  if (result.error) return sendError(response, 404, result.error, { resource: 'technical_documents' });
  sendSuccess(response, 200, result.entry, { resource: 'technical_documents', action: 'comment' });
};

export const postTechnicalDocumentIngesta = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await addDocumentIngesta(id, request.body || {}, actor);
  if (result.error) return sendError(response, 404, result.error, { resource: 'technical_documents' });
  sendSuccess(response, 200, result.entry, { resource: 'technical_documents', action: 'ingesta' });
};

export const patchTechnicalDocumentRevisar = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await workflowRevisar(id, request.body || {}, actor);
  if (result.error) return sendError(response, 400, result.error, { resource: 'technical_documents' });
  sendSuccess(response, 200, result.entry, { resource: 'technical_documents', action: 'revisar' });
};

export const patchTechnicalDocumentObservar = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await workflowObservar(id, request.body || {}, actor);
  if (result.error) {
    const st = result.error.includes('no autorizado') ? 403 : 400;
    return sendError(response, st, result.error, { resource: 'technical_documents' });
  }
  sendSuccess(response, 200, result.entry, { resource: 'technical_documents', action: 'observar' });
};

export const patchTechnicalDocumentAprobar = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await workflowAprobar(id, request.body || {}, actor);
  if (result.error) {
    if (result.error.includes('no autorizado')) {
      return sendError(response, 403, result.error, { resource: 'technical_documents' });
    }
    if (result.validationErrors) {
      return sendError(response, 422, result.error, {
        resource: 'technical_documents',
        validations: result.validationErrors,
      });
    }
    return sendError(response, 400, result.error, { resource: 'technical_documents' });
  }
  sendSuccess(response, 200, result.entry, { resource: 'technical_documents', action: 'aprobar' });
};

export const patchTechnicalDocumentEnviar = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  const result = await workflowEnviar(id, request.body || {}, actor);
  if (result.error) {
    const st = result.error.includes('no autorizado') ? 403 : 400;
    return sendError(response, st, result.error, { resource: 'technical_documents' });
  }
  sendSuccess(response, 200, result.entry, { resource: 'technical_documents', action: 'enviar' });
};
