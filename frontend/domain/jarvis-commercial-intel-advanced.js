/**
 * Inteligencia comercial avanzada — solo señales internas (sin scraping externo).
 */

export const JARVIS_COMMERCIAL_INTEL_VERSION = '2026-03-24';

const norm = (s) => String(s || '').trim().toLowerCase();

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const hoursSince = (iso) => {
  const t = parseTs(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

function probCierreHeuristic(o) {
  let p = 40;
  const est = norm(o.estado);
  if (est === 'ganada' || est === 'cerrada') return 95;
  if (est === 'perdida') return 5;
  if (est === 'cotizado') p += 20;
  if (String(o.prioridad) === 'alta') p += 15;
  const h = hoursSince(o.actualizadoEn || o.fechaCreacion || o.creadoEn);
  if (h != null && h < 48) p += 10;
  if (h != null && h > 168) p -= 25;
  p += Math.min(15, roundMoney(o.estimacionMonto) / 200_000);
  return Math.max(5, Math.min(95, Math.round(p)));
}

/**
 * @param {object} unified
 */
export function buildJarvisCommercialIntelAdvanced(unified) {
  const u = unified || {};
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const planOts = Array.isArray(u.planOts) ? u.planOts : [];

  const oportunidadesCalientes = opps
    .filter((o) => {
      if (!['pendiente', 'cotizado'].includes(String(o.estado))) return false;
      const alta = String(o.prioridad) === 'alta';
      const monto = roundMoney(o.estimacionMonto) >= 400_000;
      const h = hoursSince(o.fechaCreacion || o.creadoEn);
      const reciente = h != null && h < 72;
      return (alta && monto) || (alta && reciente);
    })
    .slice(0, 12)
    .map((o) => ({
      id: o.id,
      cliente: o.cliente || '—',
      estado: o.estado,
      estimacionMonto: roundMoney(o.estimacionMonto),
      probabilidadCierre: probCierreHeuristic(o),
      razon: String(o.prioridad) === 'alta' ? 'Prioridad alta + pipeline abierto' : 'Monto o timing favorable',
    }));

  const clientesDormidosMap = new Map();
  for (const o of opps) {
    if (!['pendiente', 'cotizado'].includes(String(o.estado))) continue;
    const h = hoursSince(o.actualizadoEn || o.fechaCreacion || o.creadoEn);
    if (h == null || h < 96) continue;
    const c = String(o.cliente || '').trim() || '—';
    if (!clientesDormidosMap.has(c)) clientesDormidosMap.set(c, { cliente: c, oppIds: [], maxHoras: 0 });
    const g = clientesDormidosMap.get(c);
    g.oppIds.push(o.id);
    g.maxHoras = Math.max(g.maxHoras, h);
  }
  const clientesDormidos = [...clientesDormidosMap.values()]
    .filter((x) => x.oppIds.length)
    .sort((a, b) => b.maxHoras - a.maxHoras)
    .slice(0, 10);

  const byComuna = new Map();
  for (const o of planOts) {
    if (String(o.tipoServicio || 'clima').toLowerCase() === 'flota') continue;
    const c = String(o.comuna || '').trim() || 'Sin comuna';
    if (!byComuna.has(c)) byComuna.set(c, { total: 0, cerradas: 0 });
    const g = byComuna.get(c);
    g.total += 1;
    if (norm(o.estado) === 'terminado') g.cerradas += 1;
  }
  const zonasSubexplotadas = [...byComuna.entries()]
    .map(([comuna, v]) => ({
      comuna,
      totalOt: v.total,
      ratioCierre: v.total ? Math.round((v.cerradas / v.total) * 100) : 0,
    }))
    .filter((z) => z.total >= 3 && z.ratioCierre < 35)
    .sort((a, b) => a.ratioCierre - b.ratioCierre)
    .slice(0, 8);

  const cotizacionesSinRespuesta = opps.filter((o) => {
    if (String(o.estado) !== 'cotizado') return false;
    const h = hoursSince(o.actualizadoEn || o.fechaCreacion);
    return h != null && h > 48;
  }).length;

  const probabilidadCierrePromedio =
    opps.length === 0
      ? null
      : Math.round(opps.reduce((s, o) => s + probCierreHeuristic(o), 0) / opps.length);

  const patronesPerdida = [];
  if (cotizacionesSinRespuesta > 0) {
    patronesPerdida.push(`${cotizacionesSinRespuesta} cotización(es) sin movimiento >48h.`);
  }
  const urgSinGestion = (u.commercialOpportunityAlerts || []).filter(
    (a) => a.code === 'OP_URGENTE_SIN_GESTION'
  ).length;
  if (urgSinGestion > 0) patronesPerdida.push(`${urgSinGestion} alerta(s) de oportunidad urgente sin gestión.`);

  return {
    version: JARVIS_COMMERCIAL_INTEL_VERSION,
    computedAt: new Date().toISOString(),
    oportunidadesCalientes,
    clientesDormidos,
    zonasSubexplotadas,
    probabilidadCierre: {
      promedioPipeline: probabilidadCierrePromedio,
      porOportunidadTop: oportunidadesCalientes.slice(0, 5),
    },
    meta: {
      cotizacionesSinRespuesta,
      patronesPerdida,
    },
  };
}
