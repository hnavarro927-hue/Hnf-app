import { createRequire } from 'node:module';

import { jarvisIntakeService } from '../services/jarvisIntake.service.js';
import { sendError, sendJson } from '../utils/http.js';

const require = createRequire(import.meta.url);
const { crearOTDesdeInput } = require('../intake/jarvis-intake');
import { getRequestActor } from '../utils/requestActor.js';

export const postJarvisIntakeClassify = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const matchContext = {
      clientes: Array.isArray(body.clientesMuestra) ? body.clientesMuestra : [],
      otsMuestra: Array.isArray(body.otsMuestra) ? body.otsMuestra : [],
      vehicles: Array.isArray(body.vehiclesMuestra) ? body.vehiclesMuestra : [],
    };
    const brief = jarvisIntakeService.classifyIntakeBody(body, matchContext);
    sendJson(res, 200, { brief, engineVersion: brief.version });
  } catch (e) {
    sendError(res, 500, e?.message || 'Error en clasificación Jarvis');
  }
};

export const postJarvisIntakeOt = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const nuevaOT = crearOTDesdeInput(body || {});
    console.log('JARVIS OT:', nuevaOT);
    sendJson(res, 200, { ok: true, ot: nuevaOT });
  } catch (e) {
    sendError(res, 500, 'Error interno del servidor.', { detail: e?.message });
  }
};

export const postJarvisIntakeRecord = async (req, res) => {
  try {
    const actor = getRequestActor(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    body.actorIngreso = body.actorIngreso || actor;
    const event = await jarvisIntakeService.appendJarvisIntakeEvent(body);
    sendJson(res, 201, { event });
  } catch (e) {
    sendError(res, 500, e?.message || 'No se pudo registrar ingesta Jarvis');
  }
};
