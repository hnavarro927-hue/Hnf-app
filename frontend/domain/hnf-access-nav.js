/**
 * Navegación según módulos devueltos por GET /auth/me (alineado al RBAC del backend).
 */

import { HNF_OS_NAV_ADMIN } from './hnf-operator-role.js';

const byId = (id) => HNF_OS_NAV_ADMIN.find((x) => x.id === id);

/** Orden de negocio para rol con acceso total. */
export const HNF_FULL_NAV_ORDER = [
  'matriz-hnf',
  'centro-control',
  'jarvis',
  'ingreso-operativo',
  'bandeja-canal',
  'bandeja-romina',
  'bandeja-gery',
  'lyn-aprobacion',
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
  'auditoria',
  'usuarios',
];

export const EXTRA_NAV = {
  auditoria: { id: 'auditoria', icon: '◆', label: 'Auditoría' },
  usuarios: { id: 'usuarios', icon: '👤', label: 'Usuarios' },
};

const isKnownShellView = (viewId) => Boolean(byId(viewId) || EXTRA_NAV[viewId]);

/**
 * @param {string[]} modules - lista del backend o ['*']
 */
export function navItemsFromModules(modules) {
  const mods = Array.isArray(modules) ? modules : [];
  if (mods.includes('*')) {
    return HNF_FULL_NAV_ORDER.map((id) => EXTRA_NAV[id] || byId(id)).filter(Boolean);
  }
  const out = [];
  for (const id of HNF_FULL_NAV_ORDER) {
    if (mods.includes(id)) {
      const item = EXTRA_NAV[id] || byId(id);
      if (item) out.push(item);
    }
  }
  return out;
}

export function isViewAllowedForModules(modules, viewId) {
  if (viewId === 'sin-acceso') return true;
  const mods = Array.isArray(modules) ? modules : [];
  const id = String(viewId || '');
  if (id === 'ingreso-clasico') {
    return mods.includes('*') || mods.includes('ingreso-operativo');
  }
  if (mods.includes('*')) return isKnownShellView(viewId);
  return mods.includes(id);
}

export function defaultViewForModules(modules) {
  const mods = Array.isArray(modules) ? modules : [];
  if (mods.includes('*')) {
    const items = navItemsFromModules(modules);
    return items.length ? items[0].id : 'sin-acceso';
  }
  if (mods.includes('clima')) return 'clima';
  if (mods.includes('flota') && !mods.includes('clima')) return 'flota';
  const items = navItemsFromModules(modules);
  if (items.length) return items[0].id;
  return 'sin-acceso';
}
