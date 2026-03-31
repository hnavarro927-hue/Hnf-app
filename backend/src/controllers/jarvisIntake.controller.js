import { createRequire } from 'node:module';

import { jarvisIntakeService } from '../services/jarvisIntake.service.js';
import { otService } from '../services/ot.service.js';
import { sendError, sendJson } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

const require = createRequire(import.meta.url);
const { crearOTDesdeInput } = require('../intake/jarvis-intake');

const mapJarvisSourceToOrigenSolicitud = (source) => {
  const s = String(source ?? '')
    .trim()
    .toLowerCase();
  if (s === 'whatsapp') return 'whatsapp';
  if (s === 'email') return 'email';
  if (s === 'llamada') return 'llamada';
  return 'interno';
};

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
    const actor = getRequestActor(req);
    const texto = String(body.texto ?? '').trim();
    const cliente = String(body.cliente ?? '').trim() || null;
    const origenSolicitud = mapJarvisSourceToOrigenSolicitud(body.source);
    const origenPedido = String(body.source ?? 'manual')
      .trim()
      .slice(0, 120);

    const draft = crearOTDesdeInput(body);
    const area = draft.area;
    const tipoServicio = area === 'flota' ? 'flota' : area === 'clima' ? 'clima' : 'clima';
    const tecnicoAsignado =
      area === 'clima' ? 'Romina' : area === 'flota' ? 'Gery' : 'Por asignar';

    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora = now.toTimeString().slice(0, 5);
    const pr = String(body.prioridadOperativa || '').toLowerCase();
    const prioridadOperativa = ['alta', 'media', 'baja'].includes(pr) ? pr : 'media';

    const payload = {
      cliente: cliente || 'Sin cliente',
      direccion: String(body.direccion ?? '').trim() || 'Por definir',
      comuna: String(body.comuna ?? '').trim() || 'Sin comuna',
      contactoTerreno: String(body.contactoTerreno ?? '').trim() || cliente || 'Contacto',
      telefonoContacto: String(body.telefonoContacto ?? '').trim() || '0',
      tipoServicio,
      subtipoServicio: String(body.subtipoServicio ?? '').trim() || 'Ingreso Jarvis',
      origenSolicitud,
      origenPedido: origenPedido || 'manual',
      prioridadOperativa,
      tecnicoAsignado,
      estadoCoreOverride: 'pendiente',
      fecha,
      hora,
      observaciones: texto,
      operationMode: 'manual',
    };

    if (origenSolicitud === 'whatsapp') {
      payload.whatsappContactoNumero =
        String(body.whatsappContactoNumero ?? '').trim() || '0000000000';
      payload.whatsappContactoNombre =
        String(body.whatsappContactoNombre ?? '').trim() || cliente || 'Contacto';
    }

    const item = await otService.create(payload, actor);
    if (item.errors) {
      return sendError(res, 400, 'Payload de OT inválido (Jarvis intake).', {
        resource: 'ots',
        validations: item.errors,
      });
    }

    console.log('JARVIS OT (persistida):', item.id);
    sendJson(res, 201, { ok: true, ot: item });
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
