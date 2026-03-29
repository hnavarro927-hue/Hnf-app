/**
 * SLA operativo y alertas automáticas para documentos Base Maestra / bandeja.
 */

import { normalizeDestinoModulo } from './maestro-document-destino.engine.js';

export const SLA_DEFAULT_PRIMERA_GESTION_MIN = 15;
export const SLA_ALERTA_MIN_1 = 15;
export const SLA_ALERTA_MIN_2 = 30;
export const SLA_ALERTA_ESCALA_MIN = 60;

export function defaultSlaCierreMinutos() {
  const e = Number(process.env.HNF_SLA_CIERRE_MINUTOS);
  return Number.isFinite(e) && e > 0 ? e : 480;
}

/** Si está definido (>0), bloquea nuevas ingestas si hay pendientes sin gestión por más de N horas. */
export function ingestionBlockHorasEnv() {
  const e = Number(process.env.HNF_INTAKE_BLOQUEO_SLA_HORAS);
  return Number.isFinite(e) && e > 0 ? e : null;
}

/** Auto-asignación solo clima / flota (comercial/admin: sin auto en esta regla). */
export function responsableAutoPorDestino(destinoFinal) {
  const d = normalizeDestinoModulo(destinoFinal);
  if (d === 'clima') return { responsable_asignado: 'romina', responsable_auto_asignado: true };
  if (d === 'flota') return { responsable_asignado: 'gery', responsable_auto_asignado: true };
  return null;
}

export function referenciaIngresoMs(doc) {
  const s = doc?.intake_fecha_ingreso || doc?.fecha_subida || doc?.createdAt;
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

export function minutosDesdeIngreso(doc, nowMs = Date.now()) {
  const t0 = referenciaIngresoMs(doc);
  if (t0 == null) return null;
  return Math.floor((nowMs - t0) / 60000);
}

export function minutosSinPrimeraGestion(doc, nowMs = Date.now()) {
  if (doc?.intake_fecha_primera_gestion) return 0;
  return minutosDesdeIngreso(doc, nowMs);
}

export function slaMaxPrimeraMin(doc) {
  const n = Number(doc?.sla_max_primera_gestion_minutos);
  return Number.isFinite(n) && n > 0 ? n : SLA_DEFAULT_PRIMERA_GESTION_MIN;
}

export function slaMaxCierreMin(doc) {
  const n = Number(doc?.sla_max_cierre_minutos);
  if (Number.isFinite(n) && n > 0) return n;
  return defaultSlaCierreMinutos();
}

/**
 * Indicador visual: normal | riesgo | urgente
 */
export function computeSlaIndicador(doc, nowMs = Date.now()) {
  const er = String(doc?.estado_revision || '').toLowerCase();
  if (er === 'archivado') {
    return { indicador: 'normal', codigo: 'archivado', sla_urgente_ui: false, minutos_sin_primera_gestion: null };
  }
  const eo = String(doc?.estado_operativo || 'pendiente').toLowerCase();
  const max1 = slaMaxPrimeraMin(doc);
  const mPrim = doc?.intake_fecha_primera_gestion ? 0 : minutosDesdeIngreso(doc, nowMs);

  if (!doc?.intake_fecha_primera_gestion && eo === 'pendiente' && mPrim != null) {
    if (mPrim >= max1) {
      return {
        indicador: 'urgente',
        codigo: 'vencido_primera_gestion',
        sla_urgente_ui: true,
        minutos_sin_primera_gestion: mPrim,
      };
    }
    const umbralRiesgo = Math.max(1, Math.floor((max1 * 2) / 3));
    if (mPrim >= umbralRiesgo) {
      return {
        indicador: 'riesgo',
        codigo: 'riesgo_primera_gestion',
        sla_urgente_ui: false,
        minutos_sin_primera_gestion: mPrim,
      };
    }
    return {
      indicador: 'normal',
      codigo: 'normal',
      sla_urgente_ui: false,
      minutos_sin_primera_gestion: mPrim,
    };
  }

  if (eo !== 'gestionado' && eo !== 'cerrado') {
    const totalMin = minutosDesdeIngreso(doc, nowMs);
    const maxC = slaMaxCierreMin(doc);
    if (totalMin != null && totalMin >= maxC) {
      return {
        indicador: 'urgente',
        codigo: 'vencido_cierre',
        sla_urgente_ui: true,
        minutos_sin_primera_gestion: mPrim,
      };
    }
    if (totalMin != null && totalMin >= Math.floor(maxC * 0.75)) {
      return {
        indicador: 'riesgo',
        codigo: 'riesgo_cierre',
        sla_urgente_ui: false,
        minutos_sin_primera_gestion: mPrim,
      };
    }
  }

  return {
    indicador: 'normal',
    codigo: 'normal',
    sla_urgente_ui: Boolean(doc?.sla_urgente),
    minutos_sin_primera_gestion: mPrim,
  };
}

export function emojiSlaIndicador(indicador) {
  const i = String(indicador || '').toLowerCase();
  if (i === 'urgente') return '🔴';
  if (i === 'riesgo') return '🟡';
  return '🟢';
}

/** Alertas por tiempo sin primera gestión (solo pendiente operativo y sin marca de gestión). */
export function buildAlertasNuevas(doc, nowMs = Date.now()) {
  const out = [];
  if (doc?.intake_fecha_primera_gestion) return out;
  const eo = String(doc?.estado_operativo || 'pendiente').toLowerCase();
  if (eo !== 'pendiente') return out;
  const er = String(doc?.estado_revision || '').toLowerCase();
  if (er === 'archivado') return out;
  const m = minutosSinPrimeraGestion(doc, nowMs);
  if (m == null || m < SLA_ALERTA_MIN_1) return out;

  const existing = new Set((doc.alertas_enviadas || []).map((a) => a.codigo));
  const add = (codigo, nivel, mensaje) => {
    if (!existing.has(codigo)) {
      out.push({ at: new Date(nowMs).toISOString(), nivel, codigo, mensaje });
      existing.add(codigo);
    }
  };
  if (m >= SLA_ALERTA_MIN_1) add('alerta_1', 1, '15 min sin primera gestión');
  if (m >= SLA_ALERTA_MIN_2) add('alerta_2', 2, '30 min sin primera gestión');
  if (m >= SLA_ALERTA_ESCALA_MIN) add('escalacion_admin', 3, '60 min sin primera gestión — escalación administrativa');
  return out;
}

export function mergeAlertas(prev, nuevas) {
  const a = Array.isArray(prev) ? [...prev] : [];
  const seen = new Set(a.map((x) => x.codigo));
  for (const n of nuevas || []) {
    if (n?.codigo && !seen.has(n.codigo)) {
      a.push(n);
      seen.add(n.codigo);
    }
  }
  return a.length > 80 ? a.slice(-80) : a;
}

export function patchSlaPersistFromEval(doc, nowMs = Date.now()) {
  const nuevas = buildAlertasNuevas(doc, nowMs);
  const ind = computeSlaIndicador(doc, nowMs);
  const sla_urgente = ind.sla_urgente_ui || ind.indicador === 'urgente';
  const merged = mergeAlertas(doc.alertas_enviadas, nuevas);
  const prevJson = JSON.stringify(doc.alertas_enviadas || []);
  const nextJson = JSON.stringify(merged);
  const prevU = Boolean(doc.sla_urgente);
  if (prevJson === nextJson && sla_urgente === prevU) return null;
  return { alertas_enviadas: merged, sla_urgente };
}

export function hayDocumentoPendienteSinGestionMasHoras(docs, horas, nowMs = Date.now()) {
  if (!horas || horas <= 0) return false;
  const limitMs = horas * 3600000;
  return docs.some((d) => {
    if (String(d.estado_revision || '').toLowerCase() === 'archivado') return false;
    if (String(d.estado_operativo || 'pendiente').toLowerCase() !== 'pendiente') return false;
    if (d.intake_fecha_primera_gestion) return false;
    const t0 = referenciaIngresoMs(d);
    if (t0 == null) return false;
    return nowMs - t0 > limitMs;
  });
}
