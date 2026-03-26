import { getWhatsappFeed, postWhatsappIngest } from '../controllers/whatsappFeed.controller.js';

export const whatsappFeedRoutes = [
  { method: 'GET', path: '/whatsapp/feed', handler: getWhatsappFeed },
  { method: 'POST', path: '/whatsapp/ingest', handler: postWhatsappIngest },
];
