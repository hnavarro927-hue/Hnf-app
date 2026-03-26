/**
 * Cerebro operativo vivo — lectura ejecutiva en cuatro capas (REALIDAD / IMPACTO / DECISIÓN / CONSECUENCIA).
 */

export const JARVIS_CEREBRO_VERSION = '2026-03-24';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

/**
 * @param {object} unified - getJarvisUnifiedState
 */
export function buildJarvisCerebroOperativo(unified) {
  const u = unified || {};
  const live = u.liveIngestion || {};
  const ops = live.currentOps || {};
  const comm = live.currentCommercial || {};
  const intake = live.currentIntake || {};
  const cr = u.jarvisFrictionPressure?.capaRealidad || {};
  const hq = u.jarvisFlowIntelligence?.hqNarrative || {};
  const ad = u.jarvisAlienDecisionCore || {};
  const lb = u.jarvisLiveBrain || {};
  const bloqueado = Math.round(Number(cr.ingresoBloqueado) || 0);
  const fuga = Math.round(Number(cr.fugaDinero) || 0);
  const proj = Math.round(Number(cr.ingresoProyectado) || 0);

  const otsAb = ops.otAbiertas ?? 0;
  const oppsN = comm.oportunidades ?? 0;
  const flujoBajo = otsAb > 0 && oppsN === 0;

  let realidad = `${otsAb} OT abiertas en vista.`;
  if (oppsN) realidad += ` ${oppsN} oportunidad(es) en pipeline.`;
  else realidad += ' Flujo comercial bajo en este corte.';
  realidad += ` Intake: ${intake.correosTotal ?? 0} correo(s) analizado(s), ${intake.whatsappMensajes ?? 0} WhatsApp.`;
  if (hq.personaFrenando) {
    realidad += ` ${hq.personaFrenando}`;
  } else if (flujoBajo) {
    realidad += ' Señal de cuello de proceso más que de una sola persona.';
  }

  const impacto = `$${fmtMoney(bloqueado)} bloqueados. Riesgo de fuga estimada $${fmtMoney(fuga)} por demora. Proyección operativa del día ~$${fmtMoney(proj)}.`;

  let decision =
    ad.focoDelDia ||
    hq.accionImpactoInmediato ||
    'Priorizar cierre con evidencia o seguimiento comercial con fecha.';
  if (ad.estadoGlobal === 'critico') {
    decision = 'Modo crítico: acción obligatoria en caja o cierre antes de expansión.';
  }

  const consecuencia =
    ad.siNoActua ||
    lb.consecuencia ||
    'Sin acción hoy, baja ritmo de caja y sube percepción de lentitud operativa.';

  return {
    version: JARVIS_CEREBRO_VERSION,
    computedAt: new Date().toISOString(),
    realidad: realidad.slice(0, 520),
    impacto: impacto.slice(0, 420),
    decision: String(decision).slice(0, 420),
    consecuencia: String(consecuencia).slice(0, 420),
  };
}
