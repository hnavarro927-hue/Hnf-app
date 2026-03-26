import { ingestTechnicalDocument } from './technicalDocument.service.js';
import { sendError, sendSuccess } from '../../utils/http.js';
import { getRequestActor } from '../../utils/requestActor.js';

export const postTechnicalDocumentIngest = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await ingestTechnicalDocument(request.body || {}, actor);
  if (result.error) {
    return sendError(response, 400, result.error, { resource: 'technical_documents' });
  }
  sendSuccess(response, 201, result.payload, { resource: 'technical_documents', action: 'ingest' });
};
