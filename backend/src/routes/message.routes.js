import { approveMessageByLyn, createMessage, getAllMessages, reviewMessageByGery, updateMessageStatus } from '../controllers/message.controller.js';

export const messageRoutes = [
  { method: 'GET', path: '/messages', handler: getAllMessages },
  { method: 'POST', path: '/messages', handler: createMessage },
  { method: 'PATCH', path: '/messages/:id/review', handler: reviewMessageByGery },
  { method: 'PATCH', path: '/messages/:id/approve', handler: approveMessageByLyn },
  { method: 'PATCH', path: '/messages/:id/status', handler: updateMessageStatus },
];
