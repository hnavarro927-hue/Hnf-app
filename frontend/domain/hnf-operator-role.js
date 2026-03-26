/**
 * Rol operativo desde nombre guardado (localStorage `hnfActor`).
 * Admin = acceso total; resto = un módulo + una decisión por pantalla.
 */

import { getStoredOperatorName } from '../config/operator.config.js';

/** @typedef {'admin' | 'clima' | 'flota' | 'control'} HnfOperatorRole */

export const HNF_CORE_NAV = { id: 'hnf-core', icon: '⬡', label: 'Core' };

export const HNF_COMMAND_NAV_FULL = [
  { id: 'jarvis', icon: '◉', label: 'Jarvis' },
  HNF_CORE_NAV,
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
  if (role === 'clima') {
    return [HNF_COMMAND_NAV_FULL.find((x) => x.id === 'clima'), HNF_CORE_NAV].filter(Boolean);
  }
  if (role === 'flota') {
    return [
      HNF_COMMAND_NAV_FULL.find((x) => x.id === 'flota'),
      HNF_COMMAND_NAV_FULL.find((x) => x.id === 'oportunidades'),
      HNF_CORE_NAV,
    ].filter(Boolean);
  }
  if (role === 'control') {
    return [HNF_COMMAND_NAV_FULL.find((x) => x.id === 'control-gerencial'), HNF_CORE_NAV].filter(
      Boolean
    );
  }
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

/** Clientes extendidos (Hernán / Lyn) */
export function canAccessClientesManual(role) {
  return role === 'admin' || role === 'control';
}

export function canAccessDirectorioInterno(role) {
  return role === 'admin' || role === 'control';
}

export function canAccessCargaMasiva(role) {
  return role === 'admin' || role === 'control';
}

/**
 * Bandeja Jarvis: Romina solo ve ítems de clima o asignados a ella.
 * @param {object[]} queue
 * @param {HnfOperatorRole} role
 */
export function filterValidationQueueForRole(queue, role) {
  const q = Array.isArray(queue) ? queue : [];
  if (role === 'admin') return q;
  if (role === 'clima') {
    return q.filter(
      (x) =>
        String(x.sugerencias?.area || '').toLowerCase() === 'clima' ||
        String(x.sugerencias?.responsable || '').toLowerCase().includes('romina')
    );
  }
  if (role === 'flota') {
    return q.filter((x) => {
      const a = String(x.sugerencias?.area || '').toLowerCase();
      return a === 'flota' || a === 'comercial';
    });
  }
  if (role === 'control') return q;
  return q;
}
