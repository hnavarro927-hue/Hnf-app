import {
  getOperationalCalendar,
  patchOperationalCalendar,
  postOperationalCalendar,
} from '../controllers/operationalCalendar.controller.js';

export const operationalCalendarRoutes = [
  { method: 'GET', path: 'operational-calendar', handler: getOperationalCalendar },
  { method: 'POST', path: 'operational-calendar', handler: postOperationalCalendar },
  { method: 'PATCH', path: 'operational-calendar/:id', handler: patchOperationalCalendar },
];
