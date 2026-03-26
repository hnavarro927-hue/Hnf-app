import { postTechnicalDocumentIngest } from './technicalDocument.controller.js';

export const technicalDocumentIngestRoutes = [
  { method: 'POST', path: 'technical-documents/ingest', handler: postTechnicalDocumentIngest },
];
