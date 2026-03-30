import { aplicarAccionLyn, listColaLyn } from '../services/otLynAprobacion.service.js';
import { assertAction } from '../utils/rbacHttp.js';
import { readJsonBody, sendError, sendSuccess } from '../utils/http.js';

export const getLynCola = async (request, response) => {
  if (!assertAction(request, response, 'lyn.aprobacion_ot')) return;
  const url = new URL(request.url, 'http://localhost');
  const filtro = url.searchParams.get('filtro') || 'activas_lyn';
  const data = await listColaLyn({ filtro });
  sendSuccess(response, 200, data, { resource: 'ots/lyn-aprobacion/cola', filtro });
};

export const patchLynAprobacion = async (request, response) => {
  if (!assertAction(request, response, 'lyn.aprobacion_ot')) return;
  const body = await readJsonBody(request);
  const actor = request.hnfActor || 'sistema';
  const r = await aplicarAccionLyn(request.params.id, body, actor);
  if (r.error) {
    return sendError(response, 400, r.error, { resource: 'ots/lyn-aprobacion' });
  }
  sendSuccess(response, 200, r.ot, { resource: 'ots/lyn-aprobacion', action: body?.accion });
};
