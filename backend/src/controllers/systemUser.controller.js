import {
  canListUsers,
  canManageUsers,
  createUser,
  listUsers,
  patchUser,
  resetPassword,
  setUserEstado,
} from '../services/systemUser.service.js';
import { assertAction } from '../utils/rbacHttp.js';
import { sendError, sendSuccess } from '../utils/http.js';

const role = (request) => request.hnfAuth?.role || 'admin';

export const getSystemUsers = async (request, response) => {
  if (!assertAction(request, response, 'users.read')) return;
  if (!canListUsers(role(request))) {
    return sendError(response, 403, 'Sin acceso a este módulo.', { code: 'FORBIDDEN' });
  }
  const data = await listUsers();
  sendSuccess(response, 200, data, { resource: 'usuarios' });
};

export const postSystemUser = async (request, response) => {
  if (!assertAction(request, response, 'users.manage')) return;
  if (!canManageUsers(role(request))) {
    return sendError(response, 403, 'Sin acceso a este módulo.', { code: 'FORBIDDEN' });
  }
  const r = await createUser(request.body || {}, request.hnfAuth?.actorLabel);
  if (r.errors) {
    return sendError(response, 400, 'No se pudo crear el usuario.', { validations: r.errors });
  }
  sendSuccess(response, 201, r.user, { resource: 'usuarios', action: 'create' });
};

export const patchSystemUser = async (request, response) => {
  if (!assertAction(request, response, 'users.manage')) return;
  if (!canManageUsers(role(request))) {
    return sendError(response, 403, 'Sin acceso a este módulo.', { code: 'FORBIDDEN' });
  }
  const r = await patchUser(request.params?.id, request.body || {}, request.hnfAuth?.actorLabel);
  if (r.notFound) return sendError(response, 404, 'Usuario no encontrado.');
  if (r.errors) {
    return sendError(response, 400, 'No se pudo actualizar el usuario.', { validations: r.errors });
  }
  sendSuccess(response, 200, r.user, { resource: 'usuarios', action: 'patch' });
};

export const patchSystemUserEstado = async (request, response) => {
  if (!assertAction(request, response, 'users.manage')) return;
  if (!canManageUsers(role(request))) {
    return sendError(response, 403, 'Sin acceso a este módulo.', { code: 'FORBIDDEN' });
  }
  const activo = request.body?.activo;
  if (activo == null) {
    return sendError(response, 400, 'activo obligatorio (true/false).');
  }
  const r = await setUserEstado(request.params?.id, activo, request.hnfAuth?.actorLabel);
  if (r.notFound) return sendError(response, 404, 'Usuario no encontrado.');
  sendSuccess(response, 200, r.user, { resource: 'usuarios', action: 'estado' });
};

export const patchSystemUserPasswordReset = async (request, response) => {
  if (!assertAction(request, response, 'users.manage')) return;
  if (!canManageUsers(role(request))) {
    return sendError(response, 403, 'Sin acceso a este módulo.', { code: 'FORBIDDEN' });
  }
  const pwd = request.body?.password ?? request.body?.passwordTemporal;
  const r = await resetPassword(request.params?.id, pwd, request.hnfAuth?.actorLabel);
  if (r.notFound) return sendError(response, 404, 'Usuario no encontrado.');
  if (r.errors) {
    return sendError(response, 400, 'No se pudo restablecer la contraseña.', { validations: r.errors });
  }
  sendSuccess(response, 200, { ok: true }, { resource: 'usuarios', action: 'password_reset' });
};
