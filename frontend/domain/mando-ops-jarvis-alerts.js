/**
 * Hasta N alertas Jarvis con datos reales (OT + mensaje corto).
 */

import { getSessionBackendRole } from '../config/session-bridge.js';
import { filtrarOtsPorRolBackend } from './hnf-operativa-reglas.js';
import { getEffectiveEstadoOperativo } from './hnf-ot-state-engine.js';
import { mapOtToSimpleLane } from './ot-simple-kanban-lanes.js';
import { getAllOTs } from './repositories/operations-repository.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

function hoursSinceIso(iso) {
  const t = new Date(String(iso || '')).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
}

function otRiskReason(o) {
  const st = String(getEffectiveEstadoOperativo(o)).toLowerCase();
  if (Boolean(o?.riesgoDetectado)) return 'riesgo detectado';
  if (st === 'ingreso') {
    const h = hoursSinceIso(o.fecha_creacion || o.creadoEn || o.createdAt);
    if (h != null && h > 24) return 'SLA ingreso';
  }
  if (st === 'en_proceso') {
    const h = hoursSinceIso(o.fecha_actualizacion || o.updatedAt);
    if (h != null && h > 48) return 'SLA en proceso';
  }
  return null;
}

/**
 * @param {object[]} mergedOts
 * @param {number} max
 * @returns {{ id: string, severity: string, message: string, ot: object, tab?: string }[]}
 */
export function buildMandoJarvisAlerts(mergedOts, max = 3) {
  const list = Array.isArray(mergedOts) ? mergedOts : [];
  const out = [];
  const usedOt = new Set();

  const tryPush = (o, severity, message, tab) => {
    if (out.length >= max) return;
    const oid = String(o?.id ?? '');
    if (!oid || usedOt.has(oid)) return;
    usedOt.add(oid);
    out.push({
      id: `al-${oid}-${out.length}`,
      severity,
      message,
      ot: o,
      tab,
    });
  };

  for (const o of list) {
    if (mapOtToSimpleLane(o) === 'simp_finalizadas') continue;
    if (getEvidenceGaps(o).length > 0) {
      tryPush(o, 'critical', `OT ${o.id} sin evidencia completa`, 'evidencia');
    }
  }
  for (const o of list) {
    const r = otRiskReason(o);
    if (r) tryPush(o, 'critical', `OT ${o.id} · ${r}`, 'detalle');
  }
  for (const o of list) {
    const lyn = String(o?.aprobacionLynEstado || '')
      .trim()
      .toLowerCase();
    if (lyn === 'pendiente_revision_lyn') {
      tryPush(o, 'warn', `OT ${o.id} pendiente aprobación Lyn`, 'detalle');
    }
  }

  return out.slice(0, max);
}

export function countMandoJarvisAlerts(mergedOts) {
  return buildMandoJarvisAlerts(mergedOts, 999).length;
}

/** Para badge del header sin duplicar merge en la vista. */
export function countMandoJarvisAlertsFromViewData(data) {
  const raw = data?.planOts ?? data?.ots?.data ?? [];
  const arr = Array.isArray(raw) ? raw : [];
  const br = getSessionBackendRole() || 'admin';
  const list = getAllOTs(filtrarOtsPorRolBackend(arr, br));
  return countMandoJarvisAlerts(list);
}
