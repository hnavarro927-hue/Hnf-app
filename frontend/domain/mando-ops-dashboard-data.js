/**
 * Métricas y series para el dashboard Mando (datos reales, sin backend nuevo).
 */

import { buildOperationalKpisFromMergedList } from './repositories/analytics-builder.js';
import { getEffectiveEstadoOperativo } from './hnf-ot-state-engine.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

const SNAP_KEY = 'hnf-ops-kpi-snap-v1';
const TREND_KEY = 'hnf-ops-trend-activas-v1';

function hoursSinceIso(iso) {
  const t = new Date(String(iso || '')).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
}

/** Riesgo operativo por OT (misma heurística que buildOtOperationalKpis, una pasada). */
function otHasOperationalRisk(o) {
  const st = String(o?.estadoOperativo || getEffectiveEstadoOperativo(o)).toLowerCase();
  if (st === 'cerrado') return false;
  if (Boolean(o?.riesgoDetectado)) return true;
  if (st === 'ingreso') {
    const h = hoursSinceIso(o.fecha_creacion || o.creadoEn || o.createdAt);
    if (h != null && h > 24) return true;
  }
  if (st === 'en_proceso') {
    const h = hoursSinceIso(o.fecha_actualizacion || o.updatedAt);
    if (h != null && h > 48) return true;
  }
  return false;
}

/**
 * @param {object[]} mergedOts
 * @param {object[]} maestroVehiculos
 */
export function computeMandoOpsDashboardMetrics(mergedOts, maestroVehiculos) {
  const list = Array.isArray(mergedOts) ? mergedOts : [];
  const opKpi = buildOperationalKpisFromMergedList(list);
  const activas = opKpi.activas ?? 0;
  const atRisk = opKpi.riesgoOperativo ?? 0;
  const slaPct =
    activas === 0 ? 100 : Math.max(0, Math.min(100, Math.round((100 * (activas - atRisk)) / activas)));

  const veh = Array.isArray(maestroVehiculos) ? maestroVehiculos : [];
  const totalV = veh.length;
  let operV = 0;
  for (const v of veh) {
    const st = String(v.estado ?? v.estado_vehiculo ?? v.estadoVehiculo ?? '')
      .trim()
      .toLowerCase();
    if (!st) {
      operV += 1;
      continue;
    }
    if (/inactiv|baja|taller|manten|fuera|stop/i.test(st)) continue;
    operV += 1;
  }
  const flotaPct = totalV === 0 ? null : Math.round((100 * operV) / totalV);

  const criticalIds = new Set();
  for (const o of list) {
    const st = String(o?.estadoOperativo || getEffectiveEstadoOperativo(o)).toLowerCase();
    if (st === 'cerrado') continue;
    if (otHasOperationalRisk(o)) criticalIds.add(o.id);
    if (getEvidenceGaps(o).length > 0) criticalIds.add(o.id);
  }
  const alertasCriticas = criticalIds.size;

  return {
    opKpi,
    activas,
    slaPct,
    flotaPct,
    flotaTotal: totalV,
    alertasCriticas,
  };
}

export function readKpiSnapshot() {
  try {
    const raw = sessionStorage.getItem(SNAP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeKpiSnapshot(snap) {
  try {
    sessionStorage.setItem(SNAP_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

/** @param {{ activas: number, slaPct: number, flotaPct: number|null, alertasCriticas: number }} cur */
export function computeKpiDeltas(cur, prev) {
  if (!prev) {
    return {
      activas: { text: '—', up: null },
      sla: { text: '—', up: null },
      flota: { text: '—', up: null },
      alertas: { text: '—', up: null },
    };
  }
  const d = (a, b) => {
    if (b == null || a == null) return { text: '—', up: null };
    const n = a - b;
    if (n === 0) return { text: '0', up: null };
    return { text: `${n > 0 ? '+' : ''}${n}`, up: n > 0 };
  };
  const dpct = (a, b) => {
    if (b == null || a == null) return { text: '—', up: null };
    const n = a - b;
    if (Math.abs(n) < 0.5) return { text: '0 pp', up: null };
    return { text: `${n > 0 ? '+' : ''}${Math.round(n)} pp`, up: n > 0 };
  };
  return {
    activas: d(cur.activas, prev.activas),
    sla: dpct(cur.slaPct, prev.slaPct),
    flota:
      cur.flotaPct != null && prev.flotaPct != null
        ? dpct(cur.flotaPct, prev.flotaPct)
        : { text: '—', up: null },
    alertas: d(cur.alertasCriticas, prev.alertasCriticas),
  };
}

export function pushActivasTrendPoint(activas) {
  try {
    const raw = sessionStorage.getItem(TREND_KEY);
    const arr = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
    arr.push(Number(activas) || 0);
    while (arr.length > 7) arr.shift();
    sessionStorage.setItem(TREND_KEY, JSON.stringify(arr));
    return arr;
  } catch {
    return [activas];
  }
}

export function readActivasTrend() {
  try {
    const raw = sessionStorage.getItem(TREND_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.map((n) => Number(n) || 0) : [];
  } catch {
    return [];
  }
}

/**
 * @param {object[]} mergedOts
 * @param {object[]} events
 */
export function buildRecentActivityLines(mergedOts, events, max = 8) {
  const lines = [];
  const ev = Array.isArray(events) ? events : [];
  for (const e of ev.slice(0, max)) {
    const t = String(e?.tipo || e?.type || 'evento');
    const msg = String(e?.mensaje || e?.message || e?.titulo || '').trim() || t;
    const at = String(e?.at || e?.createdAt || e?.ts || '').slice(0, 16);
    lines.push({ at, text: msg });
  }
  if (lines.length >= max) return lines.slice(0, max);

  const ots = [...(Array.isArray(mergedOts) ? mergedOts : [])].sort((a, b) => {
    const ta = new Date(String(a?.updatedAt || a?.fecha_actualizacion || 0)).getTime();
    const tb = new Date(String(b?.updatedAt || b?.fecha_actualizacion || 0)).getTime();
    return tb - ta;
  });
  for (const o of ots) {
    if (lines.length >= max) break;
    const id = String(o?.id ?? '');
    const cli = String(o?.cliente || '').trim() || '—';
    const st = String(o?.estado || '').replace(/_/g, ' ');
    lines.push({
      at: String(o?.updatedAt || o?.fecha_actualizacion || '').slice(0, 16) || '—',
      text: `OT ${id} · ${cli} · ${st}`,
    });
  }
  return lines;
}

export function systemSemaphoreState(integrationStatus, alertasCriticas) {
  const ok = String(integrationStatus || '').toLowerCase().includes('conect');
  if (!ok) return 'red';
  if (alertasCriticas === 0) return 'green';
  if (alertasCriticas < 5) return 'yellow';
  return 'red';
}
