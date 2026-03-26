/**
 * Alma operativa — juicio, prioridad y acción obligatoria (no solo lectura de datos).
 */

export const JARVIS_ALIEN_INTEL_VERSION = '2026-03-24';

const roundMoney = (v) => Math.round(Number(v) || 0);

/**
 * @param {object} unifiedData - getJarvisUnifiedState(...)
 */
export function buildAlienDecisionCore(unifiedData) {
  const u = unifiedData || {};
  const fr = u.jarvisFrictionPressure || {};
  const mp = fr.modoPresion || {};
  const aa = fr.autoacciones || {};
  const cr = fr.capaRealidad || {};
  const lb = u.jarvisLiveBrain || {};
  const fi = u.jarvisFlowIntelligence || {};
  const hq = fi.hqNarrative || {};

  let estadoGlobal = 'estable';
  if (mp.nivel === 'alta') estadoGlobal = 'critico';
  else if (mp.nivel === 'media') estadoGlobal = 'tension';

  const focoDelDia =
    (typeof lb.decision === 'string' && lb.decision.trim()) ||
    hq.accionImpactoInmediato ||
    aa.hacerHoy?.[0] ||
    'Hoy: un cierre operativo con evidencia y un movimiento de pipeline con dueño y hora.';

  /** @type {{ accion: string, responsable: string, impactoDinero: number, urgencia: string }[]} */
  const top3Acciones = [];
  const push = (accion, responsable, impactoDinero, urgencia) => {
    const a = String(accion || '').trim();
    if (!a || top3Acciones.length >= 3) return;
    if (top3Acciones.some((x) => x.accion === a)) return;
    top3Acciones.push({
      accion: a,
      responsable: responsable || 'Operación',
      impactoDinero: roundMoney(impactoDinero),
      urgencia: urgencia || 'media',
    });
  };

  const bloqueado = roundMoney(cr.ingresoBloqueado || u.jarvisOperador?.moneyLeaks?.ingresoBloqueado || 0);
  push(aa.hacerHoy?.[0], 'Lyn / Operaciones', bloqueado, 'alta');
  push(aa.bloqueoCritico?.[0], 'Hernán / Caja', bloqueado, 'alta');
  push(aa.oportunidadInmediata?.[0], 'Gery / Comercial', cr.ingresoProyectado, 'alta');
  if (top3Acciones.length < 3 && Array.isArray(lb.presionDirecta)) {
    for (const line of lb.presionDirecta) {
      push(line, 'Equipo', cr.fugaDinero, 'media');
      if (top3Acciones.length >= 3) break;
    }
  }
  if (!top3Acciones.length) {
    push(focoDelDia, 'Dirección', bloqueado, mp.nivel === 'alta' ? 'critica' : 'media');
  }

  const advertencias = (fr.fricciones || [])
    .slice(0, 6)
    .map((x) => String(x.texto || x.codigo || '').trim())
    .filter(Boolean);

  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const oportunidades = opps.slice(0, 5).map((o) => ({
    texto: `${o.cliente || 'Cliente'} · ~$${roundMoney(o.estimacionMonto || o.monto || 0).toLocaleString('es-CL')} · ${o.estado || '—'}`,
    id: o.id,
    estado: o.estado,
  }));

  const siNoActua =
    lb.consecuencia ||
    (estadoGlobal === 'critico'
      ? 'Si no actuás hoy: se agrava bloqueo de caja, se enfría el pipeline y sube exposición operativa.'
      : estadoGlobal === 'tension'
        ? 'Si posponés 48h: el dinero bloqueado y las oportunidades sin dueño pasan a costo real.'
        : 'Sin movimiento explícito, el sistema parece estable pero pierde palanca de mes.');

  return {
    version: JARVIS_ALIEN_INTEL_VERSION,
    computedAt: new Date().toISOString(),
    estadoGlobal,
    focoDelDia,
    top3Acciones,
    advertencias,
    oportunidades,
    siNoActua,
  };
}
