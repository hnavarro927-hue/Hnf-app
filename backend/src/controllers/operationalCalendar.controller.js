import {
  createOperationalEntry,
  getMergedOperationalCalendar,
  patchOperationalEntry,
} from '../services/operationalCalendar.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

const qp = (request) => new URL(request.url || '/', 'http://localhost').searchParams;

export const getOperationalCalendar = async (request, response) => {
  const sp = qp(request);
  const desde = sp.get('desde') || sp.get('from') || '';
  const hasta = sp.get('hasta') || sp.get('to') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return sendError(response, 400, 'Parámetros desde y hasta requeridos (YYYY-MM-DD).');
  }
  const data = await getMergedOperationalCalendar(desde, hasta);
  sendSuccess(response, 200, data, { resource: 'operational_calendar' });
};

export const postOperationalCalendar = async (request, response) => {
  const actor = getRequestActor(request);
  const result = await createOperationalEntry(request.body || {}, actor);
  if (result.error) {
    return sendError(response, 400, result.error, { resource: 'operational_calendar' });
  }
  sendSuccess(response, 201, result.entry, { resource: 'operational_calendar', action: 'create' });
};

export const patchOperationalCalendar = async (request, response) => {
  const actor = getRequestActor(request);
  const id = request.params?.id || '';
  if (!id) return sendError(response, 400, 'ID requerido.');
  const result = await patchOperationalEntry(id, request.body || {}, actor);
  if (result.error) {
    return sendError(response, 404, result.error, { resource: 'operational_calendar' });
  }
  sendSuccess(response, 200, result.entry, { resource: 'operational_calendar', action: 'patch' });
};
