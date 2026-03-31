import { esOtExcluidaDeKpis } from './ot-kpi-audit.js';

const TERMINAL = new Set(['cerrada', 'finalizada', 'facturada']);

function diasDesdeIso(iso) {
  if (iso == null || iso === '') return null;
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (86400 * 1000);
}

/**
 * KPIs Modo Alien — solo datos de /ots; sin datos → "Sin dato".
 * @param {object[]} otsRaw
 */
export function computeJarvisAlienKpisSimple(otsRaw) {
  const list = (Array.isArray(otsRaw) ? otsRaw : []).filter((o) => !esOtExcluidaDeKpis(o));
  if (!list.length) {
    return {
      activas: '0',
      enRiesgoJarvis: '0',
      margenPromedio: 'Sin dato',
      tiempoPromedioDias: 'Sin dato',
    };
  }

  let activas = 0;
  let enRiesgoJarvis = 0;
  const ratios = [];
  const diasAct = [];

  for (const o of list) {
    const est = String(o?.estado ?? '').toLowerCase();
    if (!TERMINAL.has(est)) {
      activas += 1;
      const d = diasDesdeIso(o?.creadoEn || o?.createdAt);
      if (d != null && Number.isFinite(d)) diasAct.push(d);
    }
    if (o?.riesgoDetectado === true) enRiesgoJarvis += 1;

    const mc = Number(o?.montoCobrado);
    const ut = Number(o?.utilidad);
    if (Number.isFinite(mc) && mc > 0 && Number.isFinite(ut)) {
      ratios.push((ut / mc) * 100);
    }
  }

  const margenPromedio =
    ratios.length > 0
      ? `${(ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(1)}%`
      : 'Sin dato';

  const tiempoPromedioDias =
    diasAct.length > 0
      ? `${(diasAct.reduce((a, b) => a + b, 0) / diasAct.length).toFixed(1)} d`
      : 'Sin dato';

  return {
    activas: String(activas),
    enRiesgoJarvis: String(enRiesgoJarvis),
    margenPromedio,
    tiempoPromedioDias,
  };
}
