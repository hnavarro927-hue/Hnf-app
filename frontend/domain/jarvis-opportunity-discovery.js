/**
 * Opportunity discovery — oportunidades proyectadas aunque no estén en pipeline formal.
 */

export const JARVIS_OPPORTUNITY_DISCOVERY_VERSION = '2026-03-22';

const norm = (s) => String(s || '').trim().toLowerCase();

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

/**
 * @param {object} unified
 * @param {ReturnType<typeof import('./jarvis-reality-engine.js').runJarvisRealityEngine>} reality
 */
export function runOpportunityDiscoveryEngine(unified, reality) {
  const u = unified || {};
  const r = reality || {};
  const inf = r.inferred || {};
  const ticket = inf.ticketPromedio || 280_000;
  const planOts = Array.isArray(u.planOts) ? u.planOts : [];
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const otsClima = planOts.filter(isOtClima);
  const abiertas = otsClima.filter((o) => norm(o.estado) !== 'terminado');

  /** @type {{ id: string, tipo: string, titulo: string, valorEstimado: number, probabilidad: number, accionSugerida: string }[]} */
  const out = [];

  const byCliente = new Map();
  for (const o of otsClima) {
    const c = String(o.cliente || '').trim();
    if (!c) continue;
    byCliente.set(c, (byCliente.get(c) || 0) + 1);
  }
  const byClienteOpp = new Map();
  for (const o of opps) {
    const c = String(o.cliente || '').trim();
    if (!c) continue;
    byClienteOpp.set(c, (byClienteOpp.get(c) || 0) + 1);
  }

  for (const [cliente, n] of byCliente) {
    if (n >= 3 && (byClienteOpp.get(cliente) || 0) === 0) {
      out.push({
        id: `disc-recurrente-${norm(cliente).slice(0, 24)}`,
        tipo: 'contrato_recurrencia',
        titulo: `Cliente recurrente (${n} OT) sin upsell ni contrato mensual`,
        valorEstimado: roundMoney(ticket * 0.45 * Math.min(n, 6)),
        probabilidad: 42,
        accionSugerida: `Proponer plan mensual o bolsa de horas a ${cliente} esta semana.`,
      });
      break;
    }
  }

  const byComuna = new Map();
  for (const o of abiertas) {
    const z = String(o.comuna || o.zona || '').trim() || 'sin_zona';
    byComuna.set(z, (byComuna.get(z) || 0) + 1);
  }
  const sortedZ = [...byComuna.entries()].sort((a, b) => a[1] - b[1]);
  if (sortedZ.length >= 2 && sortedZ[0][1] <= 1) {
    const zona = sortedZ[0][0];
    out.push({
      id: `disc-zona-${norm(zona).slice(0, 20)}`,
      tipo: 'expansion_zona',
      titulo: `Zona con poca actividad reciente: ${zona}`,
      valorEstimado: roundMoney(ticket * 0.55),
      probabilidad: 28,
      accionSugerida: 'Agendar ronda comercial o mantenimiento preventivo en esa comuna.',
    });
  }

  const sinMant = abiertas.filter((o) => {
    const st = norm(o.subtipoServicio || '');
    return st.includes('correct') || st.includes('urgenc') || norm(o.estado) === 'pendiente';
  });
  if (sinMant.length >= 2) {
    out.push({
      id: 'disc-preventivo',
      tipo: 'mantenimiento_preventivo',
      titulo: 'Clientes con trabajo reactivo — venta de mantenimiento preventivo',
      valorEstimado: roundMoney(ticket * 0.35 * Math.min(sinMant.length, 5)),
      probabilidad: 38,
      accionSugerida: 'Ofrecer visita de diagnóstico + plan anual a los clientes de esas OT abiertas.',
    });
  }

  if (r.jarvisModo === 'inferencial' && inf.oportunidadLatente) {
    out.push({
      id: 'disc-latente-global',
      tipo: 'oportunidad_latente',
      titulo: 'Oportunidad latente: cartera activa sin pipeline registrado',
      valorEstimado: roundMoney(ticket * 1.1),
      probabilidad: 33,
      accionSugerida:
        'Cargar oportunidades en ERP y llamar a 3 clientes con mayor ticket histórico (o ficticio: top sector clima).',
    });
  }

  if (!out.length) {
    out.push({
      id: 'disc-default',
      tipo: 'comercial_externo',
      titulo: 'Simulación comercial: siempre existe upsell no capturado en datos',
      valorEstimado: roundMoney(ticket * 0.4),
      probabilidad: 30,
      accionSugerida: 'Definir una sola oportunidad explícita hoy y asignar dueño + fecha de cierre.',
    });
  }

  return {
    version: JARVIS_OPPORTUNITY_DISCOVERY_VERSION,
    computedAt: new Date().toISOString(),
    oportunidades: out.slice(0, 8),
  };
}
