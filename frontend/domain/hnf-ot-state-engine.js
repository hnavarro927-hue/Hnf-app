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
  if (lyn === 'pendiente_revision_lyn') return 'pendiente_aprobacion';
  if (lyn === 'devuelto_operaciones') return 'en_proceso';

  if (estado === 'cerrada') {
    if (ambitoLyn && !lyn) return 'pendiente_aprobacion';
    return 'cerrado';
  }

  if (estado === 'en_proceso' || estado === 'en proceso') return 'en_proceso';
  if (estado === 'pendiente_validacion') return 'pendiente_aprobacion';
  if (estado === 'nueva' || estado === 'asignada' || estado === 'pendiente') {
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

function hoursSinceIso(iso) {
  const t = new Date(String(iso || '')).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3600000;
}

/**
 * KPIs desde lista normalizada (getAllOTs).
 * @param {object[]} list
 */
export function buildOtOperationalKpis(list) {
  const arr = Array.isArray(list) ? list : [];
  const byEstado = Object.fromEntries(OT_ESTADO_FLUJO.map((k) => [k, 0]));
  const byResponsable = new Map();
  let activas = 0;
  let cerradas = 0;
  let riesgoOperativo = 0;
  let prioridadAlta = 0;

  for (const o of arr) {
    const st = String(o.estadoOperativo || getEffectiveEstadoOperativo(o)).toLowerCase();
    if (byEstado[st] != null) byEstado[st] += 1;
    if (st === 'cerrado') cerradas += 1;
    else activas += 1;

    const r =
      String(o.responsable_actual || o.responsableActual || '').trim() || 'Sin asignar';
    byResponsable.set(r, (byResponsable.get(r) || 0) + 1);

    const pri = String(o.prioridadOperativa || o.prioridadSugerida || '')
      .toLowerCase()
      .trim();
    if (pri === 'alta') prioridadAlta += 1;

    let risk = Boolean(o.riesgoDetectado);
    if (st === 'ingreso') {
      const h = hoursSinceIso(o.fecha_creacion);
      if (h != null && h > 24) risk = true;
    }
    if (st === 'en_proceso') {
      const h = hoursSinceIso(o.fecha_actualizacion);
      if (h != null && h > 48) risk = true;
    }
    if (risk) riesgoOperativo += 1;
  }

  return {
    total: arr.length,
    activas,
    cerradas,
    byEstado,
    byResponsable: Object.fromEntries(byResponsable),
    prioridadAlta,
    riesgoOperativo,
  };
}

/** @deprecated Usar buildOtOperationalKpis */
export function buildOtFlowMetrics(list) {
  const k = buildOtOperationalKpis(list);
  return {
    total: k.total,
    activas: k.activas,
    cerradas: k.cerradas,
    byEstado: k.byEstado,
    riesgoSimulado: k.riesgoOperativo,
  };
}
