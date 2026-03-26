import { sendSuccess } from '../utils/http.js';
import {
  ingestFolderDocuments,
  ingestOutlookBatch,
  ingestOutlookMessage,
  listOutlookFeed,
} from '../modules/outlookIntake/outlookIntake.service.js';

export const getOutlookFeed = async (_request, response) => {
  const data = await listOutlookFeed();
  sendSuccess(response, 200, data, { resource: 'outlook_feed' });
};

export const postOutlookMessage = async (request, response) => {
  const body = request.body || {};
  const ctx = {
    clientNames: Array.isArray(body.clientNames) ? body.clientNames : [],
  };
  const out = await ingestOutlookMessage(body.message || body, ctx);
  sendSuccess(response, 200, out, { resource: 'outlook_ingest_message' });
};

export const postOutlookBatch = async (request, response) => {
  const body = request.body || {};
  const ctx = { clientNames: Array.isArray(body.clientNames) ? body.clientNames : [] };
  const out = await ingestOutlookBatch(body.messages, ctx);
  sendSuccess(response, 200, out, { resource: 'outlook_ingest_batch' });
};

export const postOutlookFolder = async (request, response) => {
  const body = request.body || {};
  const out = await ingestFolderDocuments(body.payload || body);
  sendSuccess(response, 200, out, { resource: 'outlook_ingest_folder' });
};
