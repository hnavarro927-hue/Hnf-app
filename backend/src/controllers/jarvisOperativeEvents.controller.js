import { jarvisOperativeEventsService } from '../services/jarvisOperativeEvents.service.js';
import { sendError, sendJson } from '../utils/http.js';

export const getJarvisOperativeEvents = async (_req, res) => {
  try {
    const events = await jarvisOperativeEventsService.list();
    sendJson(res, 200, { events });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudieron listar eventos Jarvis');
  }
};

export const postJarvisOperativeEvent = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const has =
      String(body.rawExcerpt || '').trim() ||
      String(body.accionInmediata || '').trim() ||
      body.tipoClasificado ||
      body.canalSalida;
    if (!has) {
      sendError(res, 400, 'Cuerpo vacío o incompleto para evento operativo.');
      return;
    }
    const event = await jarvisOperativeEventsService.append(body);
    sendJson(res, 201, { event });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudo guardar el evento Jarvis');
  }
};
