/**
 * Propuesta siempre activa: interpretación + acción sugerida + motivo.
 * No ejecuta: solo empaqueta intención para control humano.
 */

import {
  detectClienteFromText,
  mapIntakeToPrioridad,
  mapIntakeToTipoClasificado,
} from './jarvis-active-intake-engine.js';
import {
  buildLiveMemoryGrid,
  interpretOperativeEvent,
} from './jarvis-operational-interpretation.js';
import { countRecentDiscardsForCliente } from './jarvis-proposal-decisions.js';

const FB = 'Pendiente de completar — Jarvis propone validar con operación.';

function nz(s, fb = FB) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t || fb;
}

export function buildSyntheticOperativeEventFromClassification(classification, rawText, kind = 'texto') {
  const c = classification || {};
  const raw = String(rawText || c.excerpt || '').slice(0, 2000);
  return {
    rawExcerpt: raw,
    tipoClasificado: mapIntakeToTipoClasificado(c, kind === 'imagen' ? 'imagen' : 'texto'),
    prioridad: mapIntakeToPrioridad(c),
    clienteDetectado: c.clienteDetectado ?? detectClienteFromText(raw),
    responsableSugerido: c.responsable || 'sin dueño',
    impactoEconomicoHeuristico: Number(c.impactoEconomicoEstimado) || 0,
    accionInmediata: String(c.accionInmediata || '').slice(0, 2000),
    canalSalida: c.canalSalida || c.canal || 'manual',
    tipoSalida: c.tipoSalida || c.tipo,
    generaRiesgo: c.generaRiesgo,
    generaOportunidad: c.generaOportunidad,
    at: new Date().toISOString(),
    fuente: 'propuesta_sintetica',
  };
}

function riesgoEjecucionFrom(interp, oportunidadForzada) {
  if (interp.prioridad_raw === 'CRITICO' || interp.semaforo === 'rojo') return 'alto';
  if (oportunidadForzada || interp.prioridad_raw === 'ALTO' || interp.semaforo === 'ambar') return 'medio';
  return 'bajo';
}

function buildExecutePlan(interp, ev, oportunidadDetectada) {
  const cliente = String(interp.cliente_detectado || '').replace(/pendiente.*/i, '').trim();
  const flags = interp.flags || {};

  if (oportunidadDetectada || ev.generaOportunidad || flags.comercial) {
    return {
      kind: 'commercial',
      view: 'oportunidades',
      intel: cliente ? { commercial: { mode: 'list', filterCliente: cliente } } : {},
      label: 'Ir a oportunidades y generar propuesta',
    };
  }
  if (flags.evidencia_faltante || flags.cierre_pendiente) {
    return {
      kind: 'navigate',
      view: 'clima',
      intel: cliente ? { climaFilter: { clienteContains: cliente } } : {},
      label: 'Abrir Clima / OT con foco cliente',
    };
  }
  if (flags.flota) {
    return { kind: 'navigate', view: 'flota', intel: {}, label: 'Abrir Flota' };
  }
  if (interp.prioridad_raw === 'CRITICO') {
    return { kind: 'navigate', view: 'operacion-control', intel: {}, label: 'Abrir Control operación' };
  }
  return {
    kind: 'navigate',
    view: 'panel-operativo-vivo',
    intel: {},
    label: 'Abrir panel operativo del día',
  };
}

/**
 * @param {object} ev - evento operativo persistido o sintético compatible con interpretOperativeEvent
 * @param {object} [ctx]
 * @param {object[]} [ctx.jarvisEvents]
 */
export function buildJarvisProposalPack(ev, ctx = {}) {
  const interp = interpretOperativeEvent(ev || {});
  const jEvents = Array.isArray(ctx.jarvisEvents) ? ctx.jarvisEvents : [];
  const mg = ctx.memoryGrid || buildLiveMemoryGrid(jEvents, 6);
  const clienteKey = String(interp.cliente_detectado || '').toLowerCase();
  const descartes = countRecentDiscardsForCliente(clienteKey);

  const repeticion = (mg.senales?.clientesConRepeticion || 0) >= 1;
  const evidenciaFuerte = (mg.senales?.evidenciaFaltante || 0) >= 2;
  const mismoClienteActivo = jEvents.filter((e) => {
    const i = interpretOperativeEvent(e);
    return String(i.cliente_detectado || '').toLowerCase() === clienteKey && clienteKey.length > 2;
  }).length >= 2;

  const oportunidadDetectada =
    repeticion ||
    mismoClienteActivo ||
    evidenciaFuerte ||
    Boolean(ev?.generaOportunidad) ||
    Boolean(interp.flags?.comercial);

  let motivo = nz(
    `${interp.jarvis_detecto} · Área ${interp.area_sugerida} · Impacto cierre: ${String(interp.impacto_cierre).slice(0, 120)}`
  );
  if (descartes >= 2) {
    motivo += ` · Nota: hubo ${descartes} descartes recientes en este cliente — revisar antes de ejecutar.`;
  }
  if (oportunidadDetectada) {
    motivo += ` · Oportunidad: patrón o cliente activo sugiere conversación comercial o contrato de servicio.`;
  }

  const propuesta = nz(
    `Priorizar ${interp.area_sugerida}: ${interp.cliente_detectado} — ${interp.tipo_evento}. ${interp.impacto_caja.slice(0, 80)}`
  );

  const accionSugerida = nz(interp.accion_obligatoria, nz(interp.siguiente_paso, interp.acciones_disponibles?.[0]));

  const riesgo = riesgoEjecucionFrom(interp, oportunidadDetectada);
  const execute = buildExecutePlan(interp, ev || {}, oportunidadDetectada);

  const propuestaComercialLine = oportunidadDetectada
    ? `Servicio recurrente / visita técnica prioritaria para ${interp.cliente_detectado}: cerrar evidencia, propuesta de mantención o upgrade según historial.`
    : null;

  return {
    id: `jpr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    propuesta,
    accionSugerida,
    accionObligatoria: interp.accion_obligatoria,
    responsableAsignado: interp.responsable_asignado,
    impactoReferenciaPesos: interp.impacto_dinero_referencia,
    motivo,
    prioridad: interp.prioridad,
    prioridadRaw: interp.prioridad_raw,
    riesgoEjecucion: riesgo,
    execute,
    oportunidadDetectada,
    propuestaComercialLine,
    clienteContext: interp.cliente_detectado,
    enlacesADN: {
      cliente: interp.cliente_detectado,
      ubicacion: interp.tienda_detectada,
      estado: interp.estado_operativo,
      impactoCaja: interp.impacto_caja,
      impactoCierre: interp.impacto_cierre,
      impactoComercial: interp.impacto_comercial,
      historialSenales: mg.senales,
    },
  };
}

/** Propuesta por defecto: nunca silencio total en UI. */
export function buildJarvisIdleProposalPack() {
  return {
    id: 'jpr-idle',
    propuesta:
      'Decisión por defecto: registrar ingreso real. Jarvis no puede ejecutar sin señal; la acción obligatoria es alimentar el núcleo.',
    accionSugerida: 'Registrar ingreso en núcleo vivo (texto, archivo o canal).',
    accionObligatoria: 'Registrar ingreso en núcleo vivo (texto, archivo o canal).',
    responsableAsignado: 'Romina',
    impactoReferenciaPesos: 95_000,
    motivo:
      'Sin evento activo la decisión operativa es ingresar trabajo: sin eso no hay cierre de ciclo ni impacto en caja.',
    prioridad: 'Media',
    prioridadRaw: 'NORMAL',
    riesgoEjecucion: 'bajo',
    execute: { kind: 'none', view: null, intel: {}, label: '—' },
    oportunidadDetectada: false,
    propuestaComercialLine: null,
    clienteContext: null,
    enlacesADN: {
      cliente: 'Pendiente de ingesta',
      ubicacion: '—',
      estado: 'esperando_entrada',
      impactoCaja: 'Sin movimiento de caja hasta registrar caso.',
      impactoCierre: '—',
      impactoComercial: '—',
      impactoEstado: 'Cola vacía: prioridad es recepción.',
      impactoFlujo: 'Recepción → clasificación → responsable → ejecución.',
      area: 'Operación',
      prioridadLectura: 'media',
      historialSenales: null,
    },
  };
}
