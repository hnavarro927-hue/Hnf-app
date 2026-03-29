/**
 * Roles canónicos HNF (alineado a nombres operativos hasta login formal).
 * Permisos: módulos (vista / área) y acciones (API críticas).
 */

export const HNF_ROLES = ['admin', 'hernan', 'lyn', 'romina', 'gery', 'tecnico', 'conductor'];

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

/** Vista / módulo shell (ids alineados a frontend) */
export const MODULE_ACCESS = {
  admin: ['*'],
  hernan: ['*'],
  lyn: [
    'jarvis',
    'ingreso-operativo',
    'bandeja-canal',
    'clima',
    'planificacion',
    'flota',
    'oportunidades',
    'ordenes-compra',
    'control-gerencial',
    'finanzas',
    'equipo',
    'hnf-core',
    'documentos-tecnicos',
    'base-maestra',
    'bandeja-romina',
    'bandeja-gery',
    'bandeja-lyn',
  ],
  romina: [
    'jarvis',
    'ingreso-operativo',
    'bandeja-canal',
    'clima',
    'planificacion',
    'ordenes-compra',
    'hnf-core',
    'base-maestra',
    'bandeja-romina',
  ],
  gery: [
    'jarvis',
    'ingreso-operativo',
    'bandeja-canal',
    'flota',
    'planificacion',
    'ordenes-compra',
    'hnf-core',
    'base-maestra',
    'bandeja-gery',
  ],
  tecnico: ['ingreso-operativo', 'clima'],
  conductor: ['ingreso-operativo', 'equipo'],
};

/** Acciones API (guard en controladores) */
export const ACTION_ACCESS = {
  'oc.upload': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'oc.patch': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'oc.validate': ['admin', 'hernan', 'lyn'],
  'commercial.propuesta.write': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'commercial.borrador.write': ['admin', 'hernan', 'lyn', 'romina', 'gery'],
  'audit.read': ['admin', 'hernan', 'lyn'],
};

export function roleCanAccessModule(role, moduleId) {
  const r = HNF_ROLES.includes(role) ? role : 'admin';
  const mods = MODULE_ACCESS[r] || MODULE_ACCESS.admin;
  if (mods.includes('*')) return true;
  return mods.includes(String(moduleId || ''));
}

export function roleCanPerformAction(role, action) {
  const r = HNF_ROLES.includes(role) ? role : 'admin';
  const allowed = ACTION_ACCESS[action];
  if (!allowed) return true;
  return allowed.includes(r);
}
