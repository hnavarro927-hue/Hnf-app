import { randomBytes } from 'node:crypto';
import {
  ACTION_ACCESS,
  HNF_ROLES,
  getModuleListForRole,
  roleCanPerformAction,
} from '../config/rbac.config.js';
import { allowAuthLoginDebugHints } from '../config/runtimeEnv.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { systemUserRepository } from '../repositories/systemUser.repository.js';
import { hashPassword, verifyPassword } from '../utils/password.util.js';
import { auditService } from './audit.service.js';

const truthyEnv = (v) => v === '1' || String(v || '').toLowerCase() === 'true';

const sessionDays = Number(process.env.HNF_SESSION_DAYS || 30);
const SESSION_MS = (Number.isFinite(sessionDays) && sessionDays > 0 ? sessionDays : 30) * 86400000;

export function sanitizeUser(u) {
  if (!u || typeof u !== 'object') return null;
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    username: u.username,
    rol: u.rol,
    activo: u.activo !== false,
    ultimoAccesoAt: u.ultimoAccesoAt ?? null,
    creadoAt: u.creadoAt ?? null,
    actualizadoAt: u.actualizadoAt ?? null,
  };
}

export function buildMePayload(authContext) {
  const role = authContext?.role || 'admin';
  const modules = getModuleListForRole(role);
  const actions = Object.fromEntries(
    Object.keys(ACTION_ACCESS).map((a) => [a, roleCanPerformAction(role, a)])
  );
  return {
    user: sanitizeUser(authContext?.user),
    role,
    actor: authContext?.actorLabel || 'sistema',
    modules,
    actions,
    authNote:
      'Autenticación interna inicial: sesión por token almacenado en el servidor. Endurecer antes de exposición pública (HTTPS, rotación, límites).',
  };
}

let bootstrapPromise = null;

async function createHernanWithBootstrapPassword() {
  const pwd = process.env.HNF_BOOTSTRAP_ADMIN_PASSWORD || 'hnf-cambiar-2026';
  const hash = hashPassword(pwd);
  await systemUserRepository.create({
    nombre: 'Hernán',
    email: 'hernan@hnf.local',
    username: 'hernan',
    rol: 'hernan',
    activo: true,
    passwordHash: hash,
    ultimoAccesoAt: null,
  });
}

/**
 * Garantiza cuenta canónica `hernan` si el archivo tiene otros usuarios pero no este.
 */
async function ensureHernanUserPresent() {
  const existing = await systemUserRepository.findByUsername('hernan');
  if (existing) return;
  await createHernanWithBootstrapPassword();
  // eslint-disable-next-line no-console
  console.warn(
    '[HNF Auth] Usuario «hernan» creado (faltaba en hnf_system_users.json). Contraseña inicial: HNF_BOOTSTRAP_ADMIN_PASSWORD o valor por defecto de bootstrap.'
  );
}

/**
 * Solo fuera de NODE_ENV=production. Opt-in: HNF_DEV_RESET_HERNAN_ON_BOOT=1.
 * Sincroniza el hash con HNF_BOOTSTRAP_ADMIN_PASSWORD (o default) para desbloquear entornos locales.
 */
async function maybeResetHernanPasswordOnBoot() {
  if (!allowAuthLoginDebugHints()) return;
  if (!truthyEnv(process.env.HNF_DEV_RESET_HERNAN_ON_BOOT)) return;
  const u = await systemUserRepository.findByUsername('hernan');
  if (!u) return;
  const pwd = process.env.HNF_BOOTSTRAP_ADMIN_PASSWORD || 'hnf-cambiar-2026';
  await systemUserRepository.update(u.id, { passwordHash: hashPassword(pwd) });
  // eslint-disable-next-line no-console
  console.warn('[HNF Auth] HNF_DEV_RESET_HERNAN_ON_BOOT: contraseña de «hernan» actualizada al arranque (solo no-producción).');
}

export async function ensureBootstrapAdmin() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const users = await systemUserRepository.findAll();
    if (users.length === 0) {
      await createHernanWithBootstrapPassword();
      // eslint-disable-next-line no-console
      console.warn(
        '[HNF Auth] Usuario inicial creado (username: hernan). Definí HNF_BOOTSTRAP_ADMIN_PASSWORD y cambiá la contraseña desde Usuarios.'
      );
    } else {
      await ensureHernanUserPresent();
    }
    await maybeResetHernanPasswordOnBoot();
  })();
  return bootstrapPromise;
}

/** Lista usuarios sin secretos (solo para GET /auth/debug-users en no-producción). */
export async function listUsersSanitizedForDebug() {
  const users = await systemUserRepository.findAll();
  return users.map((u) => sanitizeUser(u));
}

function newSessionToken() {
  return randomBytes(32).toString('hex');
}

export async function login(username, password, requestMeta = {}) {
  await ensureBootstrapAdmin();
  const u = await systemUserRepository.findByUsername(username);
  if (!u || u.activo === false) {
    return {
      ok: false,
      code: 'INVALID',
      message: 'Usuario o contraseña incorrectos.',
      debugHint: allowAuthLoginDebugHints() ? 'USER_MISSING_OR_INACTIVE' : undefined,
    };
  }
  if (!verifyPassword(password, u.passwordHash)) {
    return {
      ok: false,
      code: 'INVALID',
      message: 'Usuario o contraseña incorrectos.',
      debugHint: allowAuthLoginDebugHints() ? 'BAD_PASSWORD_HASH_MISMATCH' : undefined,
    };
  }
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  await sessionRepository.create({ token, userId: u.id, expiresAt });
  const now = new Date().toISOString();
  const updated = await systemUserRepository.update(u.id, { ultimoAccesoAt: now });
  const safe = sanitizeUser(updated);
  await auditService.logCritical({
    actor: safe.nombre || safe.username,
    action: 'auth.login',
    resource: 'session',
    resourceId: safe.id,
    meta: { ip: requestMeta.ip || null },
    result: 'ok',
  });
  return { ok: true, token, expiresAt, user: safe };
}

export async function logout(token, actorLabel) {
  const t = String(token || '').trim();
  if (!t) return { ok: true };
  await sessionRepository.deleteByToken(t);
  await auditService.logCritical({
    actor: String(actorLabel || 'sistema').slice(0, 120),
    action: 'auth.logout',
    resource: 'session',
    result: 'ok',
  });
  return { ok: true };
}

export async function resolveAuthFromBearer(token) {
  const row = await sessionRepository.findByToken(token);
  if (!row) return null;
  const user = await systemUserRepository.findById(row.userId);
  if (!user || user.activo === false) return null;
  const role = HNF_ROLES.includes(user.rol) ? user.rol : 'admin';
  return {
    user,
    role,
    actorLabel: String(user.nombre || user.username || 'usuario').slice(0, 120),
    token: row.token,
  };
}
