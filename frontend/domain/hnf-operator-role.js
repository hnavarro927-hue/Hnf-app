/**
 * Rol operativo desde nombre guardado (localStorage `hnfActor`).
 * Navegación modular: centro de mando HNF por persona.
 */

import { getStoredOperatorName } from '../config/operator.config.js';

/** @typedef {'admin' | 'clima' | 'flota' | 'control' | 'tecnico'} HnfOperatorRole — `control` = gerencial / finanzas (Lyn). */

/** Clientes, directorio, validación, carga masiva (pestañas filtradas por rol en la vista). */
export const HNF_CORE_NAV = { id: 'hnf-core', icon: '⬡', label: 'Clientes' };

const pick = (id) => HNF_OS_NAV_ADMIN.find((x) => x.id === id);

export const HNF_OS_NAV_ADMIN = [
  { id: 'jarvis', icon: '◉', label: 'Jarvis' },
  { id: 'ingreso-operativo', icon: '⬊', label: 'Ingreso' },
  { id: 'bandeja-canal', icon: '▣', label: 'Bandeja' },
  { id: 'clima', icon: '◎', label: 'Clima' },
  { id: 'planificacion', icon: '◷', label: 'Planificación' },
  { id: 'flota', icon: '⛟', label: 'Flota' },
  { id: 'oportunidades', icon: '◈', label: 'Comercial' },
  { id: 'control-gerencial', icon: '⊞', label: 'Control' },
  { id: 'finanzas', icon: '◇', label: 'Finanzas' },
  { id: 'equipo', icon: '◐', label: 'Equipo' },
  HNF_CORE_NAV,
  { id: 'documentos-tecnicos', icon: '▤', label: 'Documentos' },
];

/** @deprecated Usar HNF_OS_NAV_ADMIN; se mantiene alias para imports existentes. */
export const HNF_COMMAND_NAV_FULL = HNF_OS_NAV_ADMIN;

/**
 * @returns {HnfOperatorRole}
 */
export function resolveOperatorRole() {
  const raw = getStoredOperatorName().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!raw.trim()) return 'admin';
  if (raw.includes('tecnico') || raw.includes('técnico')) return 'tecnico';
  if (raw.includes('romina')) return 'clima';
  if (raw.includes('gery')) return 'flota';
  if (raw.includes('lyn')) return 'control';
  if (raw.includes('hernan') || raw.includes('admin')) return 'admin';
  return 'admin';
}

/**
 * @param {HnfOperatorRole} role
 * @returns {typeof HNF_OS_NAV_ADMIN}
 */
export function getNavItemsForRole(role) {
  if (role === 'admin') return [...HNF_OS_NAV_ADMIN];
  if (role === 'tecnico') {
    return [pick('clima'), pick('ingreso-operativo')].filter(Boolean);
  }
  if (role === 'clima') {
    return [
      pick('jarvis'),
      pick('clima'),
      pick('planificacion'),
      pick('ingreso-operativo'),
      pick('bandeja-canal'),
      HNF_CORE_NAV,
    ].filter(Boolean);
  }
  if (role === 'flota') {
    return [
      pick('jarvis'),
      pick('flota'),
      pick('ingreso-operativo'),
      pick('bandeja-canal'),
      HNF_CORE_NAV,
    ].filter(Boolean);
  }
  if (role === 'control') {
    return [
      pick('jarvis'),
      pick('control-gerencial'),
      pick('oportunidades'),
      HNF_CORE_NAV,
      pick('documentos-tecnicos'),
      pick('ingreso-operativo'),
      pick('bandeja-canal'),
      pick('finanzas'),
      pick('equipo'),
      pick('planificacion'),
    ].filter(Boolean);
  }
  return [...HNF_OS_NAV_ADMIN];
}

/**
 * @param {HnfOperatorRole} role
 */
export function defaultViewForRole(role) {
  if (role === 'tecnico') return 'clima';
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
 * Bandeja validación: Romina solo ve ítems de clima o asignados a ella.
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
      return a === 'flota';
    });
  }
  if (role === 'control') return q;
  return q;
}
