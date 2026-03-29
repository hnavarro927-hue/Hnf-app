import { HNF_ROLES } from '../config/rbac.config.js';
import { systemUserRepository } from '../repositories/systemUser.repository.js';
import { hashPassword } from '../utils/password.util.js';
import { auditService } from './audit.service.js';
import { sanitizeUser } from './auth.service.js';

const lynUsersEnabled = () =>
  process.env.HNF_LYN_CAN_MANAGE_USERS === '1' ||
  String(process.env.HNF_LYN_CAN_MANAGE_USERS || '').toLowerCase() === 'true';

export function canManageUsers(role) {
  if (role === 'admin' || role === 'hernan') return true;
  if (role === 'lyn' && lynUsersEnabled()) return true;
  return false;
}

export function canListUsers(role) {
  return canManageUsers(role);
}

const validateRole = (rol) => HNF_ROLES.includes(String(rol || '').toLowerCase());

export async function listUsers() {
  const rows = await systemUserRepository.findAll();
  return rows.map((u) => sanitizeUser(u));
}

export async function createUser(body, actorLabel) {
  const nombre = String(body?.nombre || '').trim();
  const email = String(body?.email || '').trim();
  const username = String(body?.username || '')
    .trim()
    .toLowerCase();
  const rol = String(body?.rol || '').trim().toLowerCase();
  const activo = body?.activo !== false;
  const password = body?.password ?? body?.passwordTemporal;

  const errors = [];
  if (!nombre) errors.push('nombre obligatorio');
  if (!email) errors.push('email obligatorio');
  if (!username) errors.push('usuario obligatorio');
  if (!validateRole(rol)) errors.push('rol inválido');
  if (!password || String(password).length < 6) errors.push('contraseña temporal mínimo 6 caracteres');

  if (errors.length) return { errors };

  const exists = await systemUserRepository.findByUsername(username);
  if (exists) return { errors: ['ese nombre de usuario ya existe'] };

  const row = await systemUserRepository.create({
    nombre,
    email,
    username,
    rol,
    activo,
    passwordHash: hashPassword(String(password)),
    ultimoAccesoAt: null,
  });

  await auditService.logCritical({
    actor: String(actorLabel || 'sistema').slice(0, 120),
    action: 'users.create',
    resource: 'system_user',
    resourceId: row.id,
    meta: { username: row.username, rol: row.rol },
    result: 'ok',
  });

  return { user: sanitizeUser(row) };
}

export async function patchUser(id, body, actorLabel) {
  const cur = await systemUserRepository.findById(id);
  if (!cur) return { notFound: true };

  const patch = {};
  if (body.nombre != null) patch.nombre = String(body.nombre).trim();
  if (body.email != null) patch.email = String(body.email).trim();
  if (body.rol != null) {
    const rol = String(body.rol).trim().toLowerCase();
    if (!validateRole(rol)) return { errors: ['rol inválido'] };
    patch.rol = rol;
  }
  if (body.activo != null) patch.activo = Boolean(body.activo);

  if (Object.keys(patch).length === 0) return { errors: ['sin cambios'] };

  const prevRol = cur.rol;
  const row = await systemUserRepository.update(id, patch);

  if (patch.rol != null && patch.rol !== prevRol) {
    await auditService.logCritical({
      actor: String(actorLabel || 'sistema').slice(0, 120),
      action: 'users.role_change',
      resource: 'system_user',
      resourceId: id,
      meta: { desde: prevRol, hacia: patch.rol },
      result: 'ok',
    });
  }

  return { user: sanitizeUser(row) };
}

export async function setUserEstado(id, activo, actorLabel) {
  const cur = await systemUserRepository.findById(id);
  if (!cur) return { notFound: true };
  const row = await systemUserRepository.update(id, { activo: Boolean(activo) });
  await auditService.logCritical({
    actor: String(actorLabel || 'sistema').slice(0, 120),
    action: activo ? 'users.activate' : 'users.deactivate',
    resource: 'system_user',
    resourceId: id,
    meta: { username: row.username },
    result: 'ok',
  });
  return { user: sanitizeUser(row) };
}

export async function resetPassword(id, password, actorLabel) {
  const cur = await systemUserRepository.findById(id);
  if (!cur) return { notFound: true };
  if (!password || String(password).length < 6) {
    return { errors: ['contraseña mínimo 6 caracteres'] };
  }
  await systemUserRepository.update(id, { passwordHash: hashPassword(String(password)) });
  await auditService.logCritical({
    actor: String(actorLabel || 'sistema').slice(0, 120),
    action: 'users.password_reset',
    resource: 'system_user',
    resourceId: id,
    meta: { username: cur.username },
    result: 'ok',
  });
  return { ok: true };
}
