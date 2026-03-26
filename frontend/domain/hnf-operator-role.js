/**
 * Rol operativo desde nombre guardado (localStorage `hnfActor`).
 * Admin = acceso total; resto = un módulo + una decisión por pantalla.
 */

import { getStoredOperatorName } from '../config/operator.config.js';

/** @typedef {'admin' | 'clima' | 'flota' | 'control'} HnfOperatorRole */

export const HNF_COMMAND_NAV_FULL = [
  { id: 'jarvis', icon: '◉', label: 'Jarvis' },
  { id: 'ingreso-operativo', icon: '⬊', label: 'Ingreso' },
  { id: 'clima', icon: '◎', label: 'Clima' },
  { id: 'flota', icon: '⛟', label: 'Flota' },
  { id: 'oportunidades', icon: '◈', label: 'Comercial' },
  { id: 'control-gerencial', icon: '⊞', label: 'Control' },
];

/**
 * @returns {HnfOperatorRole}
 */
export function resolveOperatorRole() {
  const raw = getStoredOperatorName().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!raw.trim()) return 'admin';
  if (raw.includes('romina')) return 'clima';
  if (raw.includes('gery')) return 'flota';
  if (raw.includes('lyn')) return 'control';
  if (raw.includes('hernan') || raw.includes('admin')) return 'admin';
  return 'admin';
}

/**
 * @param {HnfOperatorRole} role
 * @returns {typeof HNF_COMMAND_NAV_FULL}
 */
export function getNavItemsForRole(role) {
  if (role === 'admin') return [...HNF_COMMAND_NAV_FULL];
  if (role === 'clima') return HNF_COMMAND_NAV_FULL.filter((x) => x.id === 'clima');
  if (role === 'flota') return HNF_COMMAND_NAV_FULL.filter((x) => x.id === 'flota');
  if (role === 'control') return HNF_COMMAND_NAV_FULL.filter((x) => x.id === 'control-gerencial');
  return [...HNF_COMMAND_NAV_FULL];
}

/**
 * @param {HnfOperatorRole} role
 */
export function defaultViewForRole(role) {
  if (role === 'clima') return 'clima';
  if (role === 'flota') return 'flota';
  if (role === 'control') return 'control-gerencial';
  return 'jarvis';
}

/**
 * @param {HnfOperatorRole} role
 * @param {string} viewId
 */
export function isViewAllowedForRole(role, viewId) {
  if (role === 'admin') return true;
  return getNavItemsForRole(role).some((x) => x.id === viewId);
}
