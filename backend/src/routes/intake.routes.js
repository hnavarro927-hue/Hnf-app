import { postIntakeExterno } from '../controllers/intake.controller.js';

export const intakeRoutes = [{ method: 'POST', path: '/intake/externo', handler: postIntakeExterno }];
