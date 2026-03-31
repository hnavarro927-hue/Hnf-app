/**
 * Rol operativo desde nombre guardado (localStorage `hnfActor`).
 * Navegación modular: centro de mando HNF por persona.
 */

import { getStoredOperatorName } from '../config/operator.config.js';
import { getSessionBackendRole } from '../config/session-bridge.js';

/** @typedef {'admin' | 'clima' | 'flota' | 'control' | 'tecnico' | 'conductor'} HnfOperatorRole — `control` = gerencial / finanzas (Lyn). */

/** Clientes, directorio, validación, carga masiva (pestañas filtradas por rol en la vista). */
export const HNF_CORE_NAV = { id: 'hnf-core', icon: '⬡', label: 'Clientes' };

/** Base maestra: contactos, técnicos, vehículos, archivos y carga con revisión. */
export const HNF_BASE_MAESTRA_NAV = { id: 'base-maestra', icon: '▦', label: 'Base maestra' };

/** Bandejas operativas de documentos Base Maestra / Jarvis (por responsable). */
export const HNF_BANDEJA_ROMINA_NAV = { id: 'bandeja-romina', icon: '▤', label: 'Bandeja Romina' };
export const HNF_BANDEJA_GERY_NAV = { id: 'bandeja-gery', icon: '▤', label: 'Bandeja Gery' };
export const HNF_BANDEJA_LYN_NAV = { id: 'lyn-aprobacion', icon: '✓', label: 'Cola Lyn (OT)' };

const pick = (id) => HNF_OS_NAV_ADMIN.find((x) => x.id === id);

/** Centro de control gerencial (Hernán / Lyn). Sin detalle operativo. */
export const HNF_MATRIZ_NAV = { id: 'matriz-hnf', icon: '▣', label: 'Matriz HNF' };

/** Centro de control operativo visual (Kanban + KPI; drawer en lugar de modales largos). */
export const HNF_CENTRO_CONTROL_NAV = { id: 'centro-control', icon: '⬢', label: 'Mando' };

export const HNF_OS_NAV_ADMIN = [
  HNF_MATRIZ_NAV,
  HNF_CENTRO_CONTROL_NAV,
  { id: 'jarvis', icon: '◉', label: 'Jarvis HQ' },
  { id: 'ingreso-operativo', icon: '⬊', label: 'Ingesta' },
  { id: 'bandeja-canal', icon: '▣', label: 'Bandeja' },
  { id: 'clima', icon: '◎', label: 'Clima' },
  { id: 'planificacion', icon: '◷', label: 'Planificación' },
  { id: 'flota', icon: '⛟', label: 'Flota' },
  { id: 'oportunidades', icon: '◈', label: 'Comercial' },
  { id: 'ordenes-compra', icon: '▤', label: 'OC PDF' },
  { id: 'control-gerencial', icon: '⊞', label: 'Control' },
  { id: 'finanzas', icon: '◇', label: 'Finanzas' },
  { id: 'equipo', icon: '◐', label: 'Equipo' },
  HNF_CORE_NAV,
  { id: 'documentos-tecnicos', icon: '▤', label: 'Documentos' },
  HNF_BASE_MAESTRA_NAV,
  HNF_BANDEJA_ROMINA_NAV,
  HNF_BANDEJA_GERY_NAV,
  HNF_BANDEJA_LYN_NAV,
];

/** @deprecated Usar HNF_OS_NAV_ADMIN; se mantiene alias para imports existentes. */
export const HNF_COMMAND_NAV_FULL = HNF_OS_NAV_ADMIN;

/**
 * @returns {HnfOperatorRole}
 */
export function resolveOperatorRole() {
  const br = getSessionBackendRole();
  if (br === 'hernan' || br === 'admin') return 'admin';
  if (br === 'lyn') return 'control';
  if (br === 'romina') return 'clima';
  if (br === 'gery') return 'flota';
  if (br === 'tecnico') return 'tecnico';
  if (br === 'conductor') return 'conductor';

  const raw = getStoredOperatorName().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!raw.trim()) return 'admin';
  if (raw.includes('tecnico') || raw.includes('técnico')) return 'tecnico';
  if (raw.includes('conductor')) return 'conductor';
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
  if (role === 'conductor') {
    return [pick('flota'), pick('ingreso-operativo')].filter(Boolean);
  }
  if (role === 'clima') {
    return [
      pick('jarvis'),
      pick('centro-control'),
      pick('clima'),
      pick('planificacion'),
      pick('ordenes-compra'),
      pick('ingreso-operativo'),
      pick('bandeja-canal'),
      HNF_CORE_NAV,
      HNF_BASE_MAESTRA_NAV,
      HNF_BANDEJA_ROMINA_NAV,
    ].filter(Boolean);
  }
  if (role === 'flota') {
    return [
      pick('jarvis'),
      pick('centro-control'),
      pick('flota'),
      pick('ordenes-compra'),
      pick('ingreso-operativo'),
      pick('bandeja-canal'),
      HNF_CORE_NAV,
      HNF_BASE_MAESTRA_NAV,
      HNF_BANDEJA_GERY_NAV,
    ].filter(Boolean);
  }
  if (role === 'control') {
    return [
      pick('jarvis'),
      pick('centro-control'),
      pick('control-gerencial'),
      pick('oportunidades'),
      pick('ordenes-compra'),
      HNF_CORE_NAV,
      HNF_BASE_MAESTRA_NAV,
      HNF_BANDEJA_LYN_NAV,
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
  if (role === 'conductor') return 'flota';
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
  return role === 'admin' || role === 'control' || role === 'clima' || role === 'flota';
}

export function canAccessDirectorioInterno(role) {
  return role === 'admin' || role === 'control';
}

export function canAccessCargaMasiva(role) {
  return role === 'admin' || role === 'control' || role === 'clima' || role === 'flota';
}

/** Carga de archivos con Jarvis (Base maestra). */
export function canAccessMaestroCargaArchivos(role) {
  return role === 'admin' || role === 'control' || role === 'clima' || role === 'flota';
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
