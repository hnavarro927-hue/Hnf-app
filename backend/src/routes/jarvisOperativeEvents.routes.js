import {
  getJarvisOperativeEvents,
  postJarvisOperativeEvent,
} from '../controllers/jarvisOperativeEvents.controller.js';

export const jarvisOperativeEventsRoutes = [
  { method: 'GET', path: '/jarvis-operative-events', handler: getJarvisOperativeEvents },
  { method: 'POST', path: '/jarvis-operative-events', handler: postJarvisOperativeEvent },
];
