/**
 * Errores de negocio (operación), no solo técnicos.
 */

export const JARVIS_BUSINESS_ERRORS_VERSION = '2026-03-24';

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

/**
 * @param {object} unified
 */
export function detectJarvisBusinessErrors(unified) {
  const u = unified || {};
  const planOts = Array.isArray(u.planOts) ? u.planOts : [];
  const opps = Array.isArray(u.commercialOpportunities) ? u.commercialOpportunities : [];
  const fi = u.jarvisFlowIntelligence;
  const econ = fi?.economicState || {};
  const flow = fi?.flowState || {};

  const otsClima = planOts.filter((o) => String(o.tipoServicio || 'clima').toLowerCase() !== 'flota');
  const abiertas = otsClima.filter((o) => norm(o.estado) !== 'terminado');

  const sinMotivo = abiertas.filter((o) => {
    const obs = String(o.observaciones || '').trim();
    const sub = String(o.subtipoServicio || '').trim();
    return obs.length < 4 && sub.length < 4;
  });

  const terminadasSinFacturacion = otsClima.filter(
    (o) => norm(o.estado) === 'terminado' && roundMoney(o.montoCobrado) <= 0
  );

  const tiempoMuerto = {
    diasPromedioAbiertas: flow._meta?.avgIdleOpenDays ?? null,
    inactividadCritica: Boolean(flow.inactividadCritica),
    detalle: flow.inactividadCritica
      ? 'OT abiertas con antigüedad operativa preocupante.'
      : 'Tiempo muerto dentro de parámetros aceptables en este corte.',
  };

  const opPend = opps.filter((o) => ['pendiente', 'cotizado'].includes(String(o.estado)));
  const opGanadas = opps.filter((o) => ['ganada', 'cerrada'].includes(norm(o.estado)));
  const conversion =
    opPend.length + opGanadas.length === 0
      ? null
      : Math.round((opGanadas.length / (opPend.length + opGanadas.length)) * 100);

  const ineficiencia = {
    ritmo: flow.ritmo || '—',
    saturacion: flow.saturacion ?? null,
    conversionComercialPct: conversion,
    mensaje:
      flow.ritmo === 'bajo' && (conversion != null && conversion < 25)
        ? 'Ritmo operativo bajo y conversión comercial débil — revisar asignación y seguimiento.'
        : flow.ritmo === 'bajo'
          ? 'Ritmo de cierre bajo — priorizar despacho de OT y bloqueos técnicos.'
          : 'Eficiencia operativa sin señal crítica en este corte.',
  };

  const malaAsignacion = {
    sinTecnico: abiertas.filter((o) => !String(o.tecnicoAsignado || '').trim()).length,
    concentracion: fi?.humanSignals?._meta?.cargaOtAbiertaPorPersona || null,
    mensaje:
      abiertas.filter((o) => !String(o.tecnicoAsignado || '').trim()).length >= 2
        ? 'Varias OT abiertas sin técnico asignado — riesgo de tiempo muerto y reclamos.'
        : 'Asignación técnica aceptable o cola pequeña.',
  };

  const fugaIngresos = {
    montoBloqueado: econ.ingresoBloqueado ?? 0,
    fugaDemora: econ.fugaDinero ?? 0,
    terminadasSinCobro: terminadasSinFacturacion.length,
    detalle: [
      ...(terminadasSinFacturacion.length
        ? [`${terminadasSinFacturacion.length} OT terminada(s) sin monto cobrado registrado.`]
        : []),
      ...((econ.ingresoBloqueado || 0) > 0
        ? [`Ingreso bloqueado estimado en cola abierta ~$${Math.round(econ.ingresoBloqueado).toLocaleString('es-CL')}.`]
        : []),
    ],
  };

  return {
    version: JARVIS_BUSINESS_ERRORS_VERSION,
    computedAt: new Date().toISOString(),
    fugaIngresos,
    malaAsignacion,
    tiempoMuerto,
    ineficiencia,
    meta: {
      otAbiertasSinMotivoClaro: sinMotivo.length,
      muestraOtIdsSinMotivo: sinMotivo.slice(0, 5).map((o) => o.id),
    },
  };
}
