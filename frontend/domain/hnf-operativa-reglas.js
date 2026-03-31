/**
 * Reglas operativas HNF — producto (asignación, roles, alertas, límites Jarvis).
 * - Asignación: delegada a jarvis-intake-engine.js (espejo de backend jarvis-intake + hnf-ot-bandeja).
 * - Sin datos inventados: prioridades y atrasos solo si hay campos/fechas reales o umbrales pasados explícitos.
 */

import { areaFromTipoServicio, bandejaFromArea } from './jarvis-intake-engine.js';

// --- 1) Asignación automática (Clima → Romina, Flota → Gery, …) ---

/**
 * @param {string} tipoServicio
 * @returns {{ area: string, bandeja: string, operadorTitular: string }}
 */
export function asignacionOperativaDesdeTipoServicio(tipoServicio) {
  const area = areaFromTipoServicio(tipoServicio);
  const { bandeja, responsable } = bandejaFromArea(area);
  return {
    area,
    bandeja,
    operadorTitular: responsable,
  };
}

// --- 2) Roles (alineado a rbac backend + módulos reales) ---

/** Lyn, Hernán y admin ven todo el espectro operativo de OT por tipo. */
export function backendRolTieneAccesoTotalOt(rolBackend) {
  const r = String(rolBackend || '').toLowerCase().trim();
  return r === 'admin' || r === 'hernan' || r === 'lyn';
}

/**
 * Romina: solo Clima y Administrativo (bandeja Romina).
 * Gery: solo Flota (sin comercial).
 * Técnico / conductor: acotado a su frente.
 */
export function backendRolPuedeVerTipoServicioOt(rolBackend, tipoServicio) {
  if (backendRolTieneAccesoTotalOt(rolBackend)) return true;
  const r = String(rolBackend || '').toLowerCase().trim();
  const t = String(tipoServicio || '').toLowerCase().trim();
  if (r === 'romina') return t === 'clima' || t === 'administrativo';
  if (r === 'gery') return t === 'flota';
  if (r === 'tecnico') return t === 'clima' || t === 'administrativo';
  if (r === 'conductor') return t === 'flota';
  return true;
}

/**
 * @param {object[]} ots
 * @param {string} rolBackend
 */
export function filtrarOtsPorRolBackend(ots, rolBackend) {
  const list = Array.isArray(ots) ? ots : [];
  return list.filter((ot) => backendRolPuedeVerTipoServicioOt(rolBackend, ot?.tipoServicio));
}

// --- 3) Alertas: rojo = riesgo, amarillo = atraso (umbrales explícitos) ---

const ESTADOS_INGRESO_KANBAN = new Set(['nueva', 'asignada', 'pendiente_validacion']);

function diasDesdeIso(iso) {
  if (iso == null || iso === '') return null;
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (86400 * 1000);
}

/** Rojo = riesgo (bloqueo / corrección obligatoria). */
export function alertaRiesgoDesdeOt(ot) {
  if (!ot || typeof ot !== 'object') return null;
  const lyn = String(ot.aprobacionLynEstado ?? '')
    .trim()
    .toLowerCase();
  if (lyn === 'rechazado_lyn') return { tipo: 'riesgo', codigo: 'lyn_rechazado', texto: 'Rechazado Lyn' };
  if (lyn === 'devuelto_operaciones') {
    return { tipo: 'riesgo', codigo: 'lyn_devuelto', texto: 'Devuelto a operaciones' };
  }
  if (lyn === 'observado_lyn') return { tipo: 'riesgo', codigo: 'lyn_observado', texto: 'Observado Lyn' };
  if (Boolean(ot.pendienteRespuestaCliente)) {
    return { tipo: 'riesgo', codigo: 'pend_cliente', texto: 'Pendiente respuesta cliente' };
  }
  return null;
}

/** Amarillo por estado “en cola” (sin umbral de días). */
export function alertaDemoraEstadoDesdeOt(ot) {
  if (!ot || typeof ot !== 'object') return null;
  const lyn = String(ot.aprobacionLynEstado ?? '')
    .trim()
    .toLowerCase();
  if (lyn === 'pendiente_revision_lyn') {
    return { tipo: 'atraso', codigo: 'lyn_fila', texto: 'Pendiente aprobación Lyn' };
  }
  return null;
}

/**
 * Amarillo = atraso temporal. Solo si el llamador pasa umbrales (días) explícitos y hay fecha válida.
 * @param {object} ot
 * @param {{ diasAtrasoIngreso?: number, diasAtrasoPendienteLyn?: number, referenciaLynIso?: string }} opts
 */
export function alertaAtrasoDesdeOt(ot, opts = {}) {
  if (!ot || typeof ot !== 'object') return null;
  const estado = String(ot.estado ?? '')
    .trim()
    .toLowerCase();
  const lyn = String(ot.aprobacionLynEstado ?? '')
    .trim()
    .toLowerCase();

  const umbralIngreso = opts.diasAtrasoIngreso;
  if (Number.isFinite(umbralIngreso) && umbralIngreso > 0 && ESTADOS_INGRESO_KANBAN.has(estado)) {
    const base = ot.creadoEn || ot.createdAt;
    const d = diasDesdeIso(base);
    if (d != null && d >= umbralIngreso) {
      return {
        tipo: 'atraso',
        codigo: 'ingreso_demora',
        texto: `Ingreso sin avance ≥ ${umbralIngreso}d`,
      };
    }
  }

  const umbralLyn = opts.diasAtrasoPendienteLyn;
  if (Number.isFinite(umbralLyn) && umbralLyn > 0 && lyn === 'pendiente_revision_lyn') {
    const ref = opts.referenciaLynIso || ot.cerradoEn || ot.updatedAt || ot.creadoEn;
    const d = diasDesdeIso(ref);
    if (d != null && d >= umbralLyn) {
      return {
        tipo: 'atraso',
        codigo: 'lyn_revision_demora',
        texto: `Revisión Lyn pendiente ≥ ${umbralLyn}d`,
      };
    }
  }

  return null;
}

/**
 * Riesgo gana sobre atraso. Sin umbrales en opts → no hay alerta amarilla.
 * @param {object} ot
 * @param {Parameters<typeof alertaAtrasoDesdeOt>[1]} [opts]
 */
export function alertaOperativaVisual(ot, opts) {
  const r = alertaRiesgoDesdeOt(ot);
  if (r) return r;
  const d0 = alertaDemoraEstadoDesdeOt(ot);
  if (d0) return d0;
  return alertaAtrasoDesdeOt(ot, opts || {});
}

// --- 4) Jarvis: detectar / clasificar / asignar / sugerir prioridad; no aprobar ni cerrar ---

export const JARVIS_OPERATIVA_ACCION_PERMITIDA = /** @type {const} */ ([
  'detectar_entrada',
  'clasificar',
  'asignar_bandeja',
  'sugerir_prioridad',
]);

export const JARVIS_OPERATIVA_ACCION_PROHIBIDA = /** @type {const} */ ([
  'aprobar_lyn',
  'rechazar_lyn',
  'cerrar_ot',
  'cambiar_estado_cerrada',
  'marcar_facturada',
  'finalizar_ot',
]);

/**
 * @param {string} accionId
 * @returns {boolean}
 */
export function jarvisOperativaPuedeEjecutar(accionId) {
  const a = String(accionId || '')
    .trim()
    .toLowerCase();
  if (JARVIS_OPERATIVA_ACCION_PROHIBIDA.includes(a)) return false;
  return JARVIS_OPERATIVA_ACCION_PERMITIDA.includes(a);
}

/**
 * Sugerencia de prioridad solo desde campos existentes en el payload; sin aprobar ni cerrar.
 * @param {Record<string, unknown>} otOIngreso
 * @returns {{ nivel: 'alta'|'media'|'baja'|null, motivos: string[] }}
 */
export function jarvisSugerirPrioridadOperativa(otOIngreso) {
  const o = otOIngreso && typeof otOIngreso === 'object' ? otOIngreso : {};
  const motivos = [];
  const declared = String(o.prioridadOperativa || '')
    .trim()
    .toLowerCase();
  if (declared === 'alta' || declared === 'media' || declared === 'baja') {
    motivos.push('prioridadOperativa');
    return { nivel: declared, motivos };
  }
  const lyn = String(o.aprobacionLynEstado || '')
    .trim()
    .toLowerCase();
  if (lyn === 'observado_lyn') {
    motivos.push('aprobacionLynEstado:observado_lyn');
    return { nivel: 'alta', motivos };
  }
  if (Boolean(o.pendienteRespuestaCliente)) {
    motivos.push('pendienteRespuestaCliente');
    return { nivel: 'media', motivos };
  }
  return { nivel: null, motivos: [] };
}

/**
 * Flujo Jarvis declarado (documentación ejecutable): detecta → clasifica → asigna → sugiere prioridad.
 * No muta OT; devuelve solo sugerencias.
 * @param {object} payloadEntrada — p.ej. borrador ingreso operativo
 */
export function jarvisPipelineSugerenciasOperativas(payloadEntrada) {
  const p = payloadEntrada && typeof payloadEntrada === 'object' ? payloadEntrada : {};
  const tipo = p.tipoServicio;
  const asign = asignacionOperativaDesdeTipoServicio(tipo);
  const prior = jarvisSugerirPrioridadOperativa(p);
  return {
    entradaDetectada: Object.keys(p).length > 0,
    area: asign.area,
    bandejaSugerida: asign.bandeja,
    operadorTitularSugerido: asign.operadorTitular,
    prioridadSugerida: prior.nivel,
    prioridadMotivos: prior.motivos,
    /** Jarvis no aprueba Lyn ni cierra OT en este pipeline. */
    accionesExcluidas: [...JARVIS_OPERATIVA_ACCION_PROHIBIDA],
  };
}

// --- 5) Carril Kanban "ingreso" (alineado a mapOtToLane en control-center) ---

export const ESTADOS_OT_CARRIL_INGRESO = ['nueva', 'asignada', 'pendiente_validacion'];

/** @param {Record<string, unknown>} ot */
export function otCorrespondeCarilIngresoPorEstado(ot) {
  const estado = String(ot?.estado ?? '')
    .trim()
    .toLowerCase();
  return ESTADOS_OT_CARRIL_INGRESO.includes(estado);
}
