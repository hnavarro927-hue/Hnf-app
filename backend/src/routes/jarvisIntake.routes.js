import { postJarvisIntakeClassify, postJarvisIntakeRecord } from '../controllers/jarvisIntake.controller.js';

export const jarvisIntakeRoutes = [
  { method: 'POST', path: '/jarvis-intake/classify', handler: postJarvisIntakeClassify },
  { method: 'POST', path: '/jarvis-intake/record', handler: postJarvisIntakeRecord },
];
