import { OT_ESTADO_FLUJO } from './hnf-ot-operational-model.js';

/**
 * Mapea OT legacy (API) a un estado de flujo sin persistir aún.
 * La columna "aprobado" agrupa Lyn pendiente + aprobado (detalle en tarjeta).
 */
export function mapLegacyOtToEstadoOperativo(ot) {
  if (!ot || typeof ot !== 'object') return 'ingreso';

  const estado = String(ot.estado ?? '')
    .trim()
    .toLowerCase();
  const lyn = String(ot.aprobacionLynEstado ?? '')
    .trim()
    .toLowerCase();
  const tipo = String(ot.tipoServicio ?? '')
    .trim()
    .toLowerCase();
  const ambitoLyn = tipo === 'clima' || tipo === 'flota';
  const enviado = Boolean(ot.enviadoCliente);

  if (estado === 'facturada' || estado === 'finalizada') return 'cerrado';
  if (lyn === 'rechazado_lyn') return 'cerrado';

  if (enviado) return 'enviado';
  if (lyn === 'aprobado_lyn') return 'aprobado';
  if (lyn === 'observado_lyn') return 'observado';
  if (lyn === 'pendiente_revision_lyn') return 'aprobado';
  if (lyn === 'devuelto_operaciones') return 'en_proceso';

  if (estado === 'cerrada') {
    if (ambitoLyn && !lyn) return 'aprobado';
    return 'cerrado';
  }

  if (estado === 'en_proceso' || estado === 'en proceso') return 'en_proceso';
  if (estado === 'pendiente_validacion' || estado === 'nueva' || estado === 'asignada' || estado === 'pendiente') {
    return 'ingreso';
  }

  return 'ingreso';
}

/**
 * @param {object} ot
 * @returns {string}
 */
export function getEffectiveEstadoOperativo(ot) {
  const eo = String(ot?.estadoOperativo ?? '').toLowerCase();
  if (OT_ESTADO_FLUJO.includes(eo)) return eo;
  return mapLegacyOtToEstadoOperativo(ot);
}

/**
 * Solo pasos adyacentes en la cadena (sin saltos).
 * @param {string} from
 * @param {string} to
 */
export function canTransitionEstado(from, to) {
  const a = String(from || '').toLowerCase();
  const b = String(to || '').toLowerCase();
  if (a === b) return true;
  const i = OT_ESTADO_FLUJO.indexOf(a);
  const j = OT_ESTADO_FLUJO.indexOf(b);
  if (i < 0 || j < 0) return false;
  return Math.abs(i - j) === 1;
}

/**
 * @param {string} current
 * @returns {string[]}
 */
export function validTargetEstados(current) {
  const c = String(current || '').toLowerCase();
  const i = OT_ESTADO_FLUJO.indexOf(c);
  if (i < 0) return ['ingreso'];
  const out = new Set([c]);
  if (i > 0) out.add(OT_ESTADO_FLUJO[i - 1]);
  if (i + 1 < OT_ESTADO_FLUJO.length) out.add(OT_ESTADO_FLUJO[i + 1]);
  return Array.from(out);
}

/**
 * Métricas simples para panel gerencial (lista ya mergeada con flujo local).
 * @param {object[]} list
 */
export function buildOtFlowMetrics(list) {
  const arr = Array.isArray(list) ? list : [];
  const byEstado = Object.fromEntries(OT_ESTADO_FLUJO.map((k) => [k, 0]));
  let activas = 0;
  let cerradas = 0;
  let riesgoSim = 0;

  for (const o of arr) {
    const st = getEffectiveEstadoOperativo(o);
    if (byEstado[st] != null) byEstado[st] += 1;
    if (st === 'cerrado') cerradas += 1;
    else activas += 1;

    const pri = String(o.prioridadOperativa || o.prioridadSugerida || '')
      .toLowerCase()
      .trim();
    if (o.riesgoDetectado || pri === 'alta') riesgoSim += 1;
  }

  return {
    total: arr.length,
    activas,
    cerradas,
    byEstado,
    riesgoSimulado: riesgoSim,
  };
}
