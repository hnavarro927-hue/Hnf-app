import {
  getJarvisStarkDocuments,
  getJarvisStarkSummary,
  postJarvisStarkDocument,
} from '../controllers/jarvisStarkDocuments.controller.js';

export const jarvisStarkDocumentsRoutes = [
  { method: 'POST', path: '/jarvis/stark/documents', handler: postJarvisStarkDocument },
  { method: 'GET', path: '/jarvis/stark/documents', handler: getJarvisStarkDocuments },
  { method: 'GET', path: '/jarvis/stark/documents/summary', handler: getJarvisStarkSummary },
];
