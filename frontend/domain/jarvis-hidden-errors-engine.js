/**
 * Errores de negocio no obvious — colas, silencios, dependencias.
 */

export const JARVIS_HIDDEN_ERRORS_VERSION = '2026-03-22';

const norm = (s) => String(s || '').trim().toLowerCase();

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const isOtClima = (o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota';

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

/**
 * @param {object} unified
 */
export function runHiddenErrorsEngine(unified) {
  const u = unified || {};
  const planOts = Array.isArray(u.planOts) ? u.planOts : [];
  const docs = Array.isArray(u.technicalDocuments) ? u.technicalDocuments : [];
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const fi = u.jarvisFlowIntelligence || {};
  const flow = fi.flowState || {};
  const hs = fi.humanSignals || {};
  const carga = hs._meta?.cargaOtAbiertaPorPersona || {};

  const otsClima = planOts.filter(isOtClima);
  const abiertas = otsClima.filter((o) => norm(o.estado) !== 'terminado');

  /** @type {{ codigo: string, titulo: string, detalle: string, severidad: 'info'|'warning'|'critical' }[]} */
  const items = [];

  const sinMovimiento = abiertas.filter((o) => {
    const d = maxOpenAgeDays(o);
    return d != null && d >= 5;
  });
  if (sinMovimiento.length) {
    items.push({
      codigo: 'OT_ABIERTA_SIN_MOVIMIENTO',
      titulo: `${sinMovimiento.length} OT abiertas sin movimiento relevante (≥5 días)`,
      detalle: 'Riesgo de fuga de ingreso y percepción de servicio lento.',
      severidad: sinMovimiento.length >= 4 ? 'critical' : 'warning',
    });
  }

  const aprobSinEnv = docs.filter((d) => d.estadoDocumento === 'aprobado' && !d.enviadoClienteEn);
  if (aprobSinEnv.length) {
    items.push({
      codigo: 'DOC_NO_ENVIADO',
      titulo: `${aprobSinEnv.length} documento(s) aprobados sin envío al cliente`,
      detalle: 'Bloquea cierre percibido y puede retrasar facturación.',
      severidad: 'warning',
    });
  }

  const terminadasSinFact = otsClima.filter(
    (o) => norm(o.estado) === 'terminado' && roundMoney(o.montoCobrado) <= 0
  );
  if (terminadasSinFact.length) {
    items.push({
      codigo: 'CIERRE_SIN_FACTURACION',
      titulo: `${terminadasSinFact.length} OT terminadas sin cobro registrado`,
      detalle: 'Dinero ejecutado pero no reflejado en economía.',
      severidad: 'critical',
    });
  }

  if (!opps.length) {
    items.push({
      codigo: 'PIPELINE_VACIO',
      titulo: 'Pipeline comercial vacío o no ingestado',
      detalle: 'Ceguera sobre próximo mes: no hay oportunidades visibles para el operador.',
      severidad: 'critical',
    });
  }

  const sinTec = abiertas.filter((o) => !String(o.tecnicoAsignado || '').trim()).length;
  if (sinTec >= 2) {
    items.push({
      codigo: 'OT_SIN_TECNICO',
      titulo: `${sinTec} OT abiertas sin técnico asignado`,
      detalle: 'Tiempo muerto y responsabilidad difusa.',
      severidad: 'warning',
    });
  }

  const vals = Object.values(carga).map((n) => Number(n) || 0);
  const sum = vals.reduce((a, b) => a + b, 0);
  const max = vals.length ? Math.max(...vals) : 0;
  if (sum >= 3 && max / Math.max(sum, 1) >= 0.62) {
    items.push({
      codigo: 'DEPENDENCIA_PERSONA',
      titulo: 'Dependencia operativa en una persona (carga desbalanceada)',
      detalle: hs.dependenciaCritica
        ? `Persona crítica: ${hs.dependenciaCritica}.`
        : 'Concentración de OT abiertas en un solo actor.',
      severidad: 'warning',
    });
  }

  if (flow.ritmo === 'bajo' && abiertas.length >= 2) {
    items.push({
      codigo: 'FLUJO_BAJO',
      titulo: 'Flujo de cierre bajo con cola abierta',
      detalle: 'El sistema produce menos cierres de los que la cola demanda.',
      severidad: 'warning',
    });
  }

  const tecnicosBajaCarga =
    sum >= 4 && max <= 1 && abiertas.length >= 3
      ? 'Capacidad técnica aparentemente subutilizada vs cola.'
      : null;
  if (tecnicosBajaCarga) {
    items.push({
      codigo: 'CAPACIDAD_SUBUTILIZADA',
      titulo: 'Posible baja carga asignada vs OT abiertas',
      detalle: tecnicosBajaCarga,
      severidad: 'info',
    });
  }

  return {
    version: JARVIS_HIDDEN_ERRORS_VERSION,
    computedAt: new Date().toISOString(),
    items: items.slice(0, 14),
    headline:
      items[0]?.titulo ||
      'Sin errores ocultos fuertes en este corte — mantener ritmo de cierre y cobro.',
  };
}
