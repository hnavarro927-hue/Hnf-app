import { getRegistroLyn, patchRegistroLyn } from '../services/controlLyn.service.js';
import { assertAction } from '../utils/rbacHttp.js';
import { readJsonBody, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

export const getControlRegistroLyn = async (request, response) => {
  if (!assertAction(request, response, 'control.registro_lyn')) return;
  const data = await getRegistroLyn();
  sendSuccess(response, 200, data, { resource: 'control/registro-lyn' });
};

export const patchControlRegistroLyn = async (request, response) => {
  if (!assertAction(request, response, 'control.registro_lyn')) return;
  const body = await readJsonBody(request);
  const actor = request.hnfActor || getRequestActor(request);
  const data = await patchRegistroLyn(body, actor);
  sendSuccess(response, 200, data, { resource: 'control/registro-lyn', action: 'patch' });
};
