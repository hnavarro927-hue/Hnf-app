/**
 * Jarvis Atomic Core — modelo “átomo operativo” sobre estado unificado + Pulse.
 */

export const JARVIS_ATOMIC_VERSION = '2026-03-24';
export const JARVIS_ATOMIC_MANTRA = 'Protejo el sistema, acelero el dinero y elimino fricción.';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

/**
 * @param {object} unified - getJarvisUnifiedState
 * @param {object} runtimeSnap - jarvisRuntimeGetSnapshot()
 * @param {object} [viewData] - payload crudo (opcional, para frescura)
 */
export function buildJarvisAtom(unified, runtimeSnap, viewData = {}) {
  const u = unified || {};
  const vd = viewData || {};
  const planOts = u.planOts ?? vd.planOts ?? vd.ots?.data ?? (Array.isArray(vd.ots) ? vd.ots : []) ?? [];
  const msgs = u.outlookFeed?.messages ?? vd.outlookFeed?.messages ?? [];
  const opps = u.commercialOpportunities ?? vd.commercialOpportunities ?? [];
  const vault = u.historicalVault?.records ?? vd.historicalVault?.records ?? [];

  const fi = u.jarvisFlowIntelligence;
  const dl = fi?.jarvisDecisionLayer ?? null;
  const econ = fi?.economicState ?? {};
  const pulse = runtimeSnap?.pulse || null;

  const nucleoOk = Boolean(dl?.focoPrincipal);
  const electronesDebil =
    (Array.isArray(planOts) && planOts.length === 0 && u.jarvisControl?.jarvisToggles?.ingestCurrentData) ||
    (u.jarvisControl?.jarvisToggles?.ingestOutlook && Array.isArray(msgs) && msgs.length === 0);

  const potMes = u.commercialSummary?.potencialTotalMes ?? 0;
  const energiaBaja =
    roundMoney(econ.ingresoProyectadoHoy || 0) < 120_000 && potMes < 400_000;

  /** @type {{ codigo: string, texto: string, severidad: string }[]} */
  const alertas = [];
  if (!nucleoOk) {
    alertas.push({
      codigo: 'ATOM_NUCLEO_CRITICO',
      texto: 'Capa de decisión vacía o incompleta — revisar datos y modo Jarvis.',
      severidad: 'critica',
    });
  }
  if (electronesDebil) {
    alertas.push({
      codigo: 'ATOM_ELECTRONES_DEBILES',
      texto: 'Pérdida de visibilidad: fuentes activas pero sin datos (OT u Outlook).',
      severidad: 'alta',
    });
  }
  if (roundMoney(econ.ingresoBloqueado) >= 400_000) {
    alertas.push({
      codigo: 'ATOM_INGRESO_BLOQUEADO_ALTO',
      texto: 'Mucho ingreso retenido en OT abiertas — priorizar cierre y facturación.',
      severidad: 'alta',
    });
  }
  if (energiaBaja) {
    alertas.push({
      codigo: 'ATOM_ENERGIA_BAJA',
      texto: 'Flujo económico del día y potencial de mes bajos — acelerar ingresos (cierres + comercial).',
      severidad: 'media',
    });
  }

  return {
    version: JARVIS_ATOMIC_VERSION,
    mantra: JARVIS_ATOMIC_MANTRA,
    núcleo: {
      decisionLayer: dl,
      ok: nucleoOk,
    },
    electrones: {
      otCount: Array.isArray(planOts) ? planOts.length : 0,
      correoCount: Array.isArray(msgs) ? msgs.length : 0,
      comercialCount: Array.isArray(opps) ? opps.length : 0,
      vaultCount: Array.isArray(vault) ? vault.length : 0,
      datosVivosOk: !electronesDebil,
      computedAt: u.computedAt || null,
    },
    órbitas: {
      pulseActivo: Boolean(pulse?.running),
      ultimoCicloAt: pulse?.lastCycleAt ?? null,
      ultimoCicloTipo: pulse?.lastCycleKind ?? null,
      intervaloMs: pulse?.intervalMs ?? null,
      ultimoErrorPulse: pulse?.lastError ?? null,
    },
    energía: {
      ingresoProyectadoHoy: econ.ingresoProyectadoHoy ?? 0,
      ingresoBloqueado: econ.ingresoBloqueado ?? 0,
      fugaDinero: econ.fugaDinero ?? 0,
      oportunidadNoTomada: econ.oportunidadNoTomada ?? 0,
      potencialMes: potMes,
      baja: energiaBaja,
    },
    estabilidad: {
      systemHealth: u.systemHealth ?? null,
      riskLevel: u.riskLevel ?? null,
      efficiencyScore: u.efficiencyScore ?? null,
      opportunityScore: u.opportunityScore ?? null,
    },
    reglas: {
      siFallaNucleo: 'alerta crítica',
      siFallaElectrones: 'pérdida de visibilidad',
      siBajaEnergia: 'foco en ingresos',
    },
    alertasDerivadas: alertas,
  };
}
