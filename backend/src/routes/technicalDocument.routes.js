import {
  getTechnicalDocumentById,
  getTechnicalDocuments,
  patchTechnicalDocumentAprobar,
  patchTechnicalDocumentById,
  patchTechnicalDocumentEnviar,
  patchTechnicalDocumentObservar,
  patchTechnicalDocumentRevisar,
  postTechnicalDocument,
  postTechnicalDocumentComment,
  postTechnicalDocumentIngesta,
} from '../controllers/technicalDocument.controller.js';
import { technicalDocumentIngestRoutes } from '../modules/technicalDocuments/technicalDocument.routes.js';

export const technicalDocumentRoutes = [
  ...technicalDocumentIngestRoutes,
  { method: 'GET', path: 'technical-documents', handler: getTechnicalDocuments },
  { method: 'GET', path: 'technical-documents/:id', handler: getTechnicalDocumentById },
  { method: 'POST', path: 'technical-documents', handler: postTechnicalDocument },
  { method: 'PATCH', path: 'technical-documents/:id/revisar', handler: patchTechnicalDocumentRevisar },
  { method: 'PATCH', path: 'technical-documents/:id/observar', handler: patchTechnicalDocumentObservar },
  { method: 'PATCH', path: 'technical-documents/:id/aprobar', handler: patchTechnicalDocumentAprobar },
  { method: 'PATCH', path: 'technical-documents/:id/enviar', handler: patchTechnicalDocumentEnviar },
  { method: 'PATCH', path: 'technical-documents/:id', handler: patchTechnicalDocumentById },
  { method: 'POST', path: 'technical-documents/:id/comments', handler: postTechnicalDocumentComment },
  { method: 'POST', path: 'technical-documents/:id/ingesta', handler: postTechnicalDocumentIngesta },
];
