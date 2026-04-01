/**
 * Reglas operativas HNF — producto (asignación, roles, alertas, límites Jarvis).
 * - Asignación: delegada a jarvis-intake-engine.js (espejo de backend jarvis-intake + hnf-ot-bandeja).
 * - Sin datos inventados: prioridades y atrasos solo si hay campos/fechas reales o umbrales pasados explícitos.
 *
 * Heurística operativa v1 (Centro de control / Jarvis copiloto):
 * - Rojo (riesgo): estados Lyn bloqueantes, pendiente respuesta cliente, o ingreso estancado ≥ diasRiesgoIngresoSinMovimiento
 *   sin pasar a en_proceso (usa creadoEn / createdAt).
 * - Amarillo (atraso): cola Lyn sin umbral de días; ingreso (nueva/asignada/pendiente_validación) ≥ diasAtrasoIngreso;
 *   revisión Lyn pendiente ≥ diasAtrasoPendienteLyn; en_proceso ≥ diasAtrasoEnProceso desde creación (SLA mínimo de avance).
 * - Prioridad sugerida (jarvisHeuristicaPrioridadOperativa): puntaje por origen (WhatsApp > correo > manual), emergencia en subtipo,
 *   tipo flota, señales Lyn/pendiente cliente, ingreso prolongado; estancamiento en ingreso fuerza “alta”.
 */

import { areaFromTipoServicio, bandejaFromArea } from './jarvis-intake-engine.js';

/** Umbrales fijos documentados; el llamador puede sobreescribir vía opts en alertaOperativaVisual. */
export const HEURISTICA_OPERATIVA_V1 = {
  diasAtrasoIngreso: 3,
  diasAtrasoPendienteLyn: 4,
  diasAtrasoEnProceso: 7,
  diasRiesgoIngresoSinMovimiento: 5,
};

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

/** Vistas gerenciales que no deben ver Romina/Gery aunque el menú falle. */
const VISTAS_GERENCIALES_OPERATIVO_DENY = new Set([
  'matriz-hnf',
  'control-gerencial',
  'finanzas',
  'oportunidades',
  'lyn-aprobacion',
]);

/**
 * Defensa en profundidad junto a MODULE_ACCESS: Romina no Flota ni gerencia; Gery no Clima ni gerencia.
 * @param {string} rolBackend — getSessionBackendRole()
 * @param {string} viewId
 */
export function isShellViewAllowedForBackendRol(rolBackend, viewId) {
  if (backendRolTieneAccesoTotalOt(rolBackend)) return true;
  const r = String(rolBackend || '').toLowerCase().trim();
  const v = String(viewId || '');
  if (v === 'gestion-ot') return true;
  if (r === 'romina') {
    if (v === 'flota') return false;
    if (VISTAS_GERENCIALES_OPERATIVO_DENY.has(v)) return false;
    return true;
  }
  if (r === 'gery') {
    if (v === 'clima') return false;
    if (VISTAS_GERENCIALES_OPERATIVO_DENY.has(v)) return false;
    return true;
  }
  if (r === 'tecnico' && v === 'flota') return false;
  if (r === 'conductor' && v === 'clima') return false;
  return true;
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

/**
 * Solo Clima → Romina y Flota → Gery (producto). Comercial/administrativo: sin titular automático por esta regla.
 * @param {string} tipoServicio
 * @returns {'Romina'|'Gery'|null}
 */
export function operadorTitularAutomaticoPorTipoServicio(tipoServicio) {
  const t = String(tipoServicio || '').toLowerCase().trim();
  if (t === 'clima') return 'Romina';
  if (t === 'flota') return 'Gery';
  return null;
}

/**
 * UI: WhatsApp | Correo | Manual (resto de orígenes persistidos caen en Manual).
 */
export function etiquetaOrigenSolicitudOperativa(origenSolicitud, origenPedido) {
  const o = String(origenSolicitud || origenPedido || '')
    .trim()
    .toLowerCase();
  if (o === 'whatsapp') return 'WhatsApp';
  if (o === 'email' || o === 'correo') return 'Correo';
  return 'Manual';
}

/**
 * Línea única para Kanban / detalle: técnico real si existe; si no, titular automático Clima/Flota; si no, texto explícito.
 */
export function textoResponsableOperativoMostrado(ot) {
  if (!ot || typeof ot !== 'object') return 'sin asignación automática';
  const tech = String(ot.tecnicoAsignado || '').trim();
  if (tech && tech !== 'Por asignar') return tech;
  const r = String(ot.responsableActual || '').trim();
  if (r && r !== 'Por asignar') return r;
  const tit = operadorTitularAutomaticoPorTipoServicio(ot.tipoServicio);
  if (tit) return tit;
  return 'sin asignación automática';
}

// --- 3) Alertas: rojo = riesgo, amarillo = atraso (umbrales explícitos) ---

const ESTADOS_INGRESO_KANBAN = new Set(['nueva', 'asignada', 'pendiente_validacion']);

function diasDesdeIso(iso) {
  if (iso == null || iso === '') return null;
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (86400 * 1000);
}

/**
 * Rojo = riesgo (bloqueo / corrección obligatoria).
 * @param {object} ot
 * @param {{ diasRiesgoIngresoSinMovimiento?: number }} [opts]
 */
export function alertaRiesgoDesdeOt(ot, opts = {}) {
  if (!ot || typeof ot !== 'object') return null;
  const lyn = String(ot.aprobacionLynEstado ?? '')
    .trim()
    .toLowerCase();
  if (lyn === 'rechazado_lyn') return { tipo: 'riesgo', codigo: 'lyn_rechazado', texto: 'Rechazado Lyn' };
  if (lyn === 'devuelto_operaciones') {
    return { tipo: 'riesgo', codigo: 'lyn_devuelto', texto: 'Devuelto a operaciones' };
  }
  if (lyn === 'observado_lyn') return { tipo: 'riesgo', codigo: 'lyn_observado', texto: 'Observado Lyn' };

  const umbralEstanc = opts.diasRiesgoIngresoSinMovimiento ?? HEURISTICA_OPERATIVA_V1.diasRiesgoIngresoSinMovimiento;
  if (Number.isFinite(umbralEstanc) && umbralEstanc > 0) {
    const estado = String(ot.estado ?? '')
      .trim()
      .toLowerCase();
    if (ESTADOS_INGRESO_KANBAN.has(estado)) {
      const base = ot.creadoEn || ot.createdAt;
      const d = diasDesdeIso(base);
      if (d != null && d >= umbralEstanc) {
        return {
          tipo: 'riesgo',
          codigo: 'ingreso_estancado',
          texto: `Ingreso sin movimiento ≥ ${umbralEstanc}d`,
        };
      }
    }
  }

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
 * @param {{ diasAtrasoIngreso?: number, diasAtrasoPendienteLyn?: number, diasAtrasoEnProceso?: number, referenciaLynIso?: string }} opts
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

  const umbralProc = opts.diasAtrasoEnProceso;
  if (Number.isFinite(umbralProc) && umbralProc > 0 && estado === 'en_proceso') {
    const base = ot.creadoEn || ot.createdAt;
    const d = diasDesdeIso(base);
    if (d != null && d >= umbralProc) {
      return {
        tipo: 'atraso',
        codigo: 'en_proceso_demora',
        texto: `En proceso ≥ ${umbralProc}d desde creación`,
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
 * Riesgo gana sobre atraso. Sin umbrales en opts → solo reglas sin días (Lyn en cola) y riesgos puros.
 * @param {object} ot
 * @param {Partial<typeof HEURISTICA_OPERATIVA_V1> & Parameters<typeof alertaAtrasoDesdeOt>[1]} [opts]
 */
export function alertaOperativaVisual(ot, opts) {
  const merged = { ...HEURISTICA_OPERATIVA_V1, ...(opts || {}) };
  const r = alertaRiesgoDesdeOt(ot, merged);
  if (r) return r;
  const d0 = alertaDemoraEstadoDesdeOt(ot);
  if (d0) return d0;
  return alertaAtrasoDesdeOt(ot, merged);
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
 * Heurística de prioridad ignorando el campo prioridadOperativa (para copiloto y comparación con lo elegido en formulario).
 * @param {Record<string, unknown>} otLike
 * @returns {{ nivel: 'alta'|'media'|'baja', motivos: string[] }}
 */
export function jarvisHeuristicaPrioridadOperativa(otLike) {
  const o = otLike && typeof otLike === 'object' ? otLike : {};
  const motivos = [];
  const lyn0 = String(o.aprobacionLynEstado || '')
    .trim()
    .toLowerCase();
  if (lyn0 === 'observado_lyn') {
    motivos.push('aprobacionLynEstado:observado_lyn');
    return { nivel: 'alta', motivos };
  }

  const origen = String(o.origenSolicitud || o.origenPedido || '')
    .trim()
    .toLowerCase();
  let score = 0;
  if (origen === 'whatsapp') {
    score += 3;
    motivos.push('origen:whatsapp');
  } else if (origen === 'email' || origen === 'correo') {
    score += 1;
    motivos.push('origen:correo');
  } else {
    motivos.push('origen:manual');
  }

  const sub = String(o.subtipoServicio || '').toLowerCase();
  if (sub.includes('emergencia')) {
    score += 2;
    motivos.push('subtipo:emergencia');
  }

  const tipo = String(o.tipoServicio || '').toLowerCase();
  if (tipo === 'flota') {
    score += 1;
    motivos.push('tipo:flota');
  }

  if (Boolean(o.pendienteRespuestaCliente)) {
    score += 1;
    motivos.push('pendienteRespuestaCliente');
  }

  const est = String(o.estado || '')
    .trim()
    .toLowerCase();
  const dCreacion = diasDesdeIso(o.creadoEn || o.createdAt);
  if (dCreacion != null && ESTADOS_INGRESO_KANBAN.has(est) && dCreacion >= 3) {
    score += 2;
    motivos.push('ingreso≥3d');
  }

  const umbralR = HEURISTICA_OPERATIVA_V1.diasRiesgoIngresoSinMovimiento;
  if (
    dCreacion != null &&
    ESTADOS_INGRESO_KANBAN.has(est) &&
    dCreacion >= umbralR
  ) {
    motivos.push('criterio:estancamiento_ingreso');
    return { nivel: 'alta', motivos };
  }

  const niv = score >= 4 ? 'alta' : score >= 2 ? 'media' : 'baja';
  return { nivel: niv, motivos };
}

/**
 * Prioridad efectiva: si la OT ya trae prioridadOperativa guardada, se devuelve como registro; si no, heurística.
 * @param {Record<string, unknown>} otOIngreso
 * @returns {{ nivel: 'alta'|'media'|'baja'|null, motivos: string[] }}
 */
export function jarvisSugerirPrioridadOperativa(otOIngreso) {
  const o = otOIngreso && typeof otOIngreso === 'object' ? otOIngreso : {};
  const declared = String(o.prioridadOperativa || '')
    .trim()
    .toLowerCase();
  if (declared === 'alta' || declared === 'media' || declared === 'baja') {
    return { nivel: declared, motivos: ['prioridadOperativa_registrada'] };
  }
  return jarvisHeuristicaPrioridadOperativa(o);
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
  const priorHeur = jarvisHeuristicaPrioridadOperativa(p);
  const titularAuto = operadorTitularAutomaticoPorTipoServicio(tipo);
  return {
    entradaDetectada: Object.keys(p).length > 0,
    area: asign.area,
    bandejaSugerida: asign.bandeja,
    operadorTitularSugerido: asign.operadorTitular,
    /** Solo Clima/Flota; null = sin asignación automática de titular por esta regla. */
    operadorTitularAutomaticoClimaFlota: titularAuto,
    prioridadSugerida: prior.nivel,
    prioridadMotivos: prior.motivos,
    prioridadHeuristica: priorHeur.nivel,
    prioridadHeuristicaMotivos: priorHeur.motivos,
    /** Jarvis no aprueba Lyn ni cierra OT en este pipeline. */
    accionesExcluidas: [...JARVIS_OPERATIVA_ACCION_PROHIBIDA],
  };
}

/**
 * Frases cortas para copiloto (Centro de control / drawer). Sin API externa.
 * @param {Record<string, unknown>} ot
 * @returns {string[]}
 */
export function jarvisCopilotFrasesOperativas(ot) {
  if (!ot || typeof ot !== 'object') return [];
  const out = [];
  const origen = etiquetaOrigenSolicitudOperativa(ot.origenSolicitud, ot.origenPedido);
  out.push(`Origen registrado: ${origen}.`);
  const tit = operadorTitularAutomaticoPorTipoServicio(ot.tipoServicio);
  if (tit) out.push(`Asignación automática titular operativo: ${tit}.`);
  else out.push('Sin asignación automática de titular (tipo distinto de Clima/Flota).');
  const h = jarvisHeuristicaPrioridadOperativa(ot);
  out.push(`Prioridad sugerida (heurística): ${h.nivel} (${h.motivos.join(', ') || 'sin señales extra'}).`);
  const av = alertaOperativaVisual(ot, HEURISTICA_OPERATIVA_V1);
  if (av?.tipo === 'riesgo') out.push(`OT en riesgo: ${av.texto}.`);
  else if (av?.tipo === 'atraso') out.push(`Atraso operativo: ${av.texto}.`);
  else out.push('Estado visual: normal (sin alerta activa).');
  return out;
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
