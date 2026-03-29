import { hnfOperativoBandejaService } from '../services/hnfOperativoBandeja.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const postOperativoCrearOtDesdeDocumento = async (request, response) => {
  const actor = getRequestActor(request);
  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const documento_id = String(body.documento_id || body.documentoId || '').trim();
  const r = await hnfOperativoBandejaService.crearOtDesdeDocumento(documento_id, actor);
  if (r.errors) return sendError(response, 400, 'No se pudo crear la OT.', { validations: r.errors });
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 201, r, { resource: 'operativo/crear-ot-desde-documento' });
};

export const patchOperativoAsignar = async (request, response) => {
  const actor = getRequestActor(request);
  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const r = await hnfOperativoBandejaService.asignarResponsableDocumento(body, actor);
  if (r.errors) return sendError(response, 400, 'Asignación inválida.', { validations: r.errors });
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'operativo/asignar' });
};

export const postOperativoMarcarGestionado = async (request, response) => {
  const actor = getRequestActor(request);
  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const documento_id = String(body.documento_id || body.documentoId || '').trim();
  const r = await hnfOperativoBandejaService.marcarEstadoOperativoDocumento(documento_id, 'gestionado', actor);
  if (r.errors) return sendError(response, 400, 'Estado inválido.', { validations: r.errors });
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'operativo/marcar-gestionado' });
};
