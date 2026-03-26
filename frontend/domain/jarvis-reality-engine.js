/**
 * Jarvis Reality Engine — inteligencia con datos escasos: inferir, estimar, proyectar.
 * No sustituye datos reales cuando existen; eleva el piso cuando el sistema está incompleto.
 */

export const JARVIS_REALITY_VERSION = '2026-03-22';

const norm = (s) => String(s || '').trim().toLowerCase();

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const parseTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const t = new Date(String(raw)).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const maxOpenAgeDays = (o) => {
  const dF = parseTs(o.fecha);
  const dU = parseTs(o.updatedAt);
  const now = Date.now();
  const days = [];
  if (Number.isFinite(dF)) days.push((now - dF) / 86400000);
  if (Number.isFinite(dU)) days.push((now - dU) / 86400000);
  if (!days.length) return null;
  return Math.max(0, ...days);
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

/**
 * @param {object} unified
 */
export function runJarvisRealityEngine(unified) {
  const u = unified || {};
  const planOts = Array.isArray(u.planOts) ? u.planOts : [];
  const docs = Array.isArray(u.technicalDocuments) ? u.technicalDocuments : [];
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const fi = u.jarvisFlowIntelligence || {};
  const econ = fi.economicState || {};
  const flow = fi.flowState || {};
  const meta = flow._meta || {};

  const otsClima = planOts.filter(isOtClima);
  const abiertas = otsClima.filter((o) => norm(o.estado) !== 'terminado');
  const cerradas = otsClima.filter((o) => norm(o.estado) === 'terminado');

  const ib = roundMoney(econ.ingresoBloqueado);
  const fd = roundMoney(econ.fugaDinero);

  const sinIngesta = planOts.length === 0 && docs.length === 0 && opps.length === 0;
  const colaInvisible = abiertas.length === 0 && ib < 8_000 && fd < 8_000;
  const datosFinosVacios = abiertas.length > 0 && ib < 3_000 && fd < 3_000;

  const jarvisModo = sinIngesta || colaInvisible || datosFinosVacios ? 'inferencial' : 'datos';

  const withMoney = cerradas.filter((o) => roundMoney(o.montoCobrado) > 0);
  let ticketPromedio =
    withMoney.length > 0
      ? withMoney.reduce((s, o) => s + roundMoney(o.montoCobrado), 0) / withMoney.length
      : 280_000;

  ticketPromedio = Math.min(Math.max(ticketPromedio, 120_000), 1_200_000);

  let ingresoPotencial = 0;
  for (const o of abiertas) {
    const m = roundMoney(o.montoCobrado);
    ingresoPotencial += m > 0 ? m : ticketPromedio * 0.55;
  }
  ingresoPotencial = roundMoney(ingresoPotencial);

  const stalled3d = abiertas.filter((o) => {
    const d = maxOpenAgeDays(o);
    return d != null && d > 3;
  });

  let fugaEstimado = 0;
  for (const o of stalled3d) {
    const base = roundMoney(o.montoCobrado) || ticketPromedio * 0.35;
    fugaEstimado += base * 0.09;
  }
  fugaEstimado = roundMoney(fugaEstimado);

  let minIngresoBloqueado = 0;
  let minFugaDinero = 0;

  if (jarvisModo === 'inferencial') {
    if (sinIngesta) {
      minIngresoBloqueado = roundMoney(ticketPromedio * 0.92);
      minFugaDinero = roundMoney(ticketPromedio * 0.24);
    } else if (abiertas.length === 0) {
      minIngresoBloqueado = roundMoney(ticketPromedio * 0.72);
      minFugaDinero = roundMoney(ticketPromedio * 0.18);
    } else {
      minIngresoBloqueado = roundMoney(Math.max(ingresoPotencial * 0.38, ticketPromedio * 0.28));
      minFugaDinero = roundMoney(
        Math.max(fugaEstimado, stalled3d.length * ticketPromedio * 0.07, ticketPromedio * 0.1)
      );
    }
  }

  const backlogEstimado =
    typeof meta.hiddenBacklogCount === 'number' && meta.hiddenBacklogCount > 0
      ? meta.hiddenBacklogCount
      : abiertas.length > 0
        ? Math.max(1, Math.ceil((meta.avgIdleOpenDays || 5) * 0.75))
        : jarvisModo === 'inferencial'
          ? 2
          : 0;

  const pipelineVacio = opps.length === 0;
  const oportunidadLatente = pipelineVacio || opps.every((o) => ['perdida', 'cancelada'].includes(norm(o.estado)));

  return {
    version: JARVIS_REALITY_VERSION,
    computedAt: new Date().toISOString(),
    jarvisModo,
    mensajeInferencia:
      jarvisModo === 'inferencial' ? 'Datos insuficientes — operando con heurística' : null,
    inferred: {
      ticketPromedio: Math.round(ticketPromedio),
      ingresoPotencial: ingresoPotencial || Math.round(minIngresoBloqueado),
      fugaEstimado: fugaEstimado || Math.round(minFugaDinero),
      otAbiertasSinCierreLento: stalled3d.length,
      backlogEstimado,
      pipelineVacio,
      oportunidadLatente,
    },
    minIngresoBloqueado,
    minFugaDinero,
  };
}
