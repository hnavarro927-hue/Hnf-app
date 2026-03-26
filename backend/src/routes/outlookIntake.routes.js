import {
  getOutlookFeed,
  postOutlookBatch,
  postOutlookFolder,
  postOutlookMessage,
} from '../controllers/outlookIntake.controller.js';

export const outlookIntakeRoutes = [
  { method: 'GET', path: '/outlook/feed', handler: getOutlookFeed },
  { method: 'POST', path: '/outlook/ingest/message', handler: postOutlookMessage },
  { method: 'POST', path: '/outlook/ingest/batch', handler: postOutlookBatch },
  { method: 'POST', path: '/outlook/ingest/folder', handler: postOutlookFolder },
];
