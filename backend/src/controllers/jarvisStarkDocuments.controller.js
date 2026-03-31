import {
  starkListRecent,
  starkSummary,
  starkUploadFromRequest,
} from '../services/jarvisStarkDocuments.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { assertAction } from '../utils/rbacHttp.js';

export const postJarvisStarkDocument = async (request, response) => {
  const ctx = assertAction(request, response, 'jarvis.stark');
  if (!ctx) return;
  const r = await starkUploadFromRequest(request, ctx);
  if (r.errors) {
    return sendError(response, 400, 'No se pudo procesar la subida.', { validations: r.errors });
  }
  sendSuccess(response, 201, r, { resource: 'jarvis-stark-documents', action: 'upload' });
};

export const getJarvisStarkDocuments = async (request, response) => {
  const ctx = assertAction(request, response, 'jarvis.stark');
  if (!ctx) return;
  const u = new URL(request.url || '/', 'http://local');
  const lim = Number(u.searchParams.get('limit'));
  const data = await starkListRecent(Number.isFinite(lim) ? lim : 120);
  sendSuccess(response, 200, data, { resource: 'jarvis-stark-documents' });
};

export const getJarvisStarkSummary = async (request, response) => {
  const ctx = assertAction(request, response, 'jarvis.stark');
  if (!ctx) return;
  const data = await starkSummary();
  sendSuccess(response, 200, data, { resource: 'jarvis-stark-documents', action: 'summary' });
};
