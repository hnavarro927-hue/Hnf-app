/**
 * Navegación según módulos devueltos por GET /auth/me (alineado al RBAC del backend).
 */

import { HNF_OS_NAV_ADMIN } from './hnf-operator-role.js';

const byId = (id) => HNF_OS_NAV_ADMIN.find((x) => x.id === id);

/**
 * Orden visible para rol `*` — tres capas: Matriz/Gerencia, Operaciones, Base maestra, Sistema.
 * Bandejas duplicadas y Equipo no van al menú principal (acceso por rol o rutas internas).
 */
export const HNF_FULL_NAV_ORDER = [
  'centro-control',
  'matriz-hnf',
  'control-gerencial',
  'finanzas',
  'jarvis',
  'ingreso-operativo',
  'lyn-aprobacion',
  'planificacion',
  'clima',
  'gestion-ot',
  'flota',
  'oportunidades',
  'ordenes-compra',
  'hnf-core',
  'base-maestra',
  'documentos-tecnicos',
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
  const mandoNav =
    mods.includes('centro-control') ||
    mods.includes('clima') ||
    mods.includes('flota') ||
    mods.includes('operacion-control');
  if (mandoNav) {
    const m = byId('centro-control');
    if (m) out.push(m);
  }
  for (const id of HNF_FULL_NAV_ORDER) {
    if (id === 'centro-control' && mandoNav) continue;
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
  if (id === 'centro-control') {
    return (
      mods.includes('*') ||
      mods.includes('centro-control') ||
      mods.includes('clima') ||
      mods.includes('flota') ||
      mods.includes('operacion-control')
    );
  }
  if (id === 'ingreso-clasico') {
    return mods.includes('*') || mods.includes('ingreso-operativo');
  }
  if (id === 'gestion-ot') {
    return mods.includes('*') || mods.includes('clima') || mods.includes('flota');
  }
  if (mods.includes('*')) return isKnownShellView(viewId);
  return mods.includes(id);
}

export function defaultViewForModules(modules) {
  const mods = Array.isArray(modules) ? modules : [];
  if (mods.includes('*')) {
    return 'centro-control';
  }
  if (mods.includes('clima') || mods.includes('flota')) return 'centro-control';
  const items = navItemsFromModules(modules);
  if (items.length) return items[0].id;
  return 'sin-acceso';
}
