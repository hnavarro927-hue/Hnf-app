/**
 * Roles canónicos HNF (sesión real + compat. resolveRbacRole por nombre).
 * Permisos: módulos (vista shell) y acciones (API).
 */

export const HNF_ROLES = ['admin', 'hernan', 'lyn', 'romina', 'gery', 'tecnico', 'conductor'];

const lynUsersEnv = () =>
  process.env.HNF_LYN_CAN_MANAGE_USERS === '1' ||
  String(process.env.HNF_LYN_CAN_MANAGE_USERS || '').toLowerCase() === 'true';

/** @param {string} actor */
export function resolveRbacRole(actor) {
  const raw = String(actor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (raw.includes('conductor')) return 'conductor';
  if (raw.includes('tecnico') || raw.includes('técnico')) return 'tecnico';
  if (raw.includes('romina')) return 'romina';
  if (raw.includes('gery')) return 'gery';
  if (raw.includes('lyn')) return 'lyn';
  if (raw.includes('hernan')) return 'hernan';
  if (raw.includes('admin')) return 'admin';
  return 'admin';
}

/** Vista / módulo shell (ids alineados al frontend). */
export const MODULE_ACCESS = {
  admin: ['*'],
  hernan: ['*'],
  lyn: [
    'matriz-hnf',
    'jarvis',
    'oportunidades',
    'finanzas',
    'base-maestra',
    'ordenes-compra',
    'control-gerencial',
    'bandeja-lyn',
    'documentos-tecnicos',
    'hnf-core',
    'planificacion',
  ],
  romina: [
    'jarvis',
    'ingreso-operativo',
    'bandeja-romina',
    'clima',
    'planificacion',
    'base-maestra',
    'documentos-tecnicos',
    'ordenes-compra',
    'hnf-core',
  ],
  gery: [
    'jarvis',
    'ingreso-operativo',
    'bandeja-gery',
    'flota',
    'planificacion',
    'base-maestra',
    'hnf-core',
  ],
  tecnico: ['clima', 'ingreso-operativo'],
  conductor: ['flota', 'ingreso-operativo'],
};

/** Acciones API (guard en controladores). Sin entrada = sin restricción explícita. */
export const ACTION_ACCESS = {
  'oc.upload': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'oc.patch': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'oc.validate': ['admin', 'hernan', 'lyn'],
  'commercial.propuesta.write': ['admin', 'hernan', 'lyn'],
  'commercial.borrador.write': ['admin', 'hernan', 'lyn'],
  'commercial.module': ['admin', 'hernan', 'lyn'],
  'audit.read': ['admin', 'hernan', 'lyn'],
  'finanzas.gerencial': ['admin', 'hernan', 'lyn'],
  'finanzas.gasto_aprobar': ['admin', 'hernan', 'lyn'],
  'maestro.read': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'maestro.write': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'maestro.document.approve': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'expenses.read': ['admin', 'hernan', 'lyn', 'romina', 'gery', 'tecnico', 'conductor'],
  'expenses.create': ['admin', 'hernan', 'lyn', 'romina', 'gery', 'tecnico', 'conductor'],
  'expenses.patch': ['admin', 'hernan', 'lyn', 'romina', 'gery', 'tecnico', 'conductor'],
  'users.read': ['admin', 'hernan'],
  'users.manage': ['admin', 'hernan'],
  'hnfcore.access': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'operativo.flow': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
};

/**
 * Lista de módulos visibles para el rol (incluye extras por env).
 */
export function getModuleListForRole(role) {
  const r = HNF_ROLES.includes(role) ? role : 'admin';
  const mods = MODULE_ACCESS[r] || MODULE_ACCESS.admin;
  if (mods.includes('*')) {
    return ['*'];
  }
  const out = [...mods];
  if (r === 'lyn' && lynUsersEnv() && !out.includes('usuarios')) {
    out.push('usuarios');
  }
  return out;
}

export function roleCanAccessModule(role, moduleId) {
  const mods = getModuleListForRole(role);
  if (mods.includes('*')) return true;
  return mods.includes(String(moduleId || ''));
}

export function roleCanPerformAction(role, action) {
  const r = HNF_ROLES.includes(role) ? role : 'admin';
  if (
    (action === 'users.read' || action === 'users.manage') &&
    r === 'lyn' &&
    lynUsersEnv()
  ) {
    return true;
  }
  const allowed = ACTION_ACCESS[action];
  if (!allowed) return true;
  return allowed.includes(r);
}
