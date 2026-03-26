/**
 * Estado visual “Alma operativa” + mapa del día (lectura pura, liviana).
 */

import { interpretOperativeEvent } from './jarvis-operational-interpretation.js';

const PHASE_KEYS = ['ingresa', 'interpreta', 'decide', 'ejecuta', 'registra'];

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * @param {object} ctx
 * @param {boolean} ctx.hasDraftText
 * @param {boolean} ctx.hasStagedFiles
 * @param {boolean} ctx.hasPendingCommit
 * @param {boolean} ctx.proposalActive
 * @param {boolean} ctx.recentlyRegistered
 */
export function computeJarvisAlmaPhases(ctx) {
  const {
    hasDraftText = false,
    hasStagedFiles = false,
    hasPendingCommit = false,
    proposalActive = false,
    recentlyRegistered = false,
  } = ctx;

  const hasIngreso = hasDraftText || hasStagedFiles;
  let activeIndex = 0;
  if (recentlyRegistered) activeIndex = 4;
  else if (hasPendingCommit && proposalActive) activeIndex = 3;
  else if (hasPendingCommit) activeIndex = 2;
  else if (hasIngreso) activeIndex = 1;
  else activeIndex = 0;

  return PHASE_KEYS.map((key, i) => {
    let estado = 'pendiente';
    if (i < activeIndex) estado = 'resuelto';
    else if (i === activeIndex) estado = 'activo';
    return { key, label: labelForPhase(key), estado };
  });
}

function labelForPhase(key) {
  const m = {
    ingresa: 'INGRESA',
    interpreta: 'INTERPRETA',
    decide: 'DECIDE',
    ejecuta: 'EJECUTA',
    registra: 'REGISTRA',
  };
  return m[key] || key;
}

/**
 * @param {object[]} jarvisEvents
 * @param {object[]} planOts
 */
export function computeMapaOperativoHoy(jarvisEvents, planOts) {
  const t0 = startOfLocalDay();
  const evs = (jarvisEvents || []).filter((e) => {
    const t = e?.at ? new Date(e.at).getTime() : NaN;
    return Number.isFinite(t) && t >= t0;
  });

  let enProceso = 0;
  let detenidos = 0;
  let sinDueno = 0;
  for (const e of evs) {
    const i = interpretOperativeEvent(e);
    const st = String(i.estado_operativo || '');
    const pr = String(i.prioridad_raw || '').toUpperCase();
    if (st.includes('requiere') || st.includes('nuevo') || pr === 'CRITICO' || pr === 'ALTO') enProceso += 1;
    if (pr === 'CRITICO' || i.semaforo === 'rojo') detenidos += 1;
    const resp = String(i.responsable_asignado || i.responsable_sugerido || '').toLowerCase();
    if (
      resp.includes('asignar') ||
      resp.includes('definir') ||
      resp.includes('técnico según ot') ||
      resp.includes('tecnico segun ot')
    ) {
      sinDueno += 1;
    }
  }

  const ots = planOts || [];
  const cerrados = ots.filter((o) => {
    const s = String(o?.estado || '').toLowerCase();
    return s.includes('cerr') || s.includes('termin') || s.includes('complet');
  }).length;

  return {
    ingresos: evs.length,
    enProceso,
    detenidos,
    sinDueno,
    cerrados,
    otsAbiertas: ots.length - cerrados,
  };
}

function pickTrace(...vals) {
  const FALL = 'requiere validación';
  for (const v of vals) {
    const t = String(v ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (t && t !== '—' && !/^pendiente\b/i.test(t)) return t;
  }
  return FALL;
}

/**
 * @param {object} opts
 * @param {object|null} opts.interp - interpretProcessResult / interpretOperativeEvent
 * @param {object|null} opts.rawEvent
 * @param {string} opts.canalLabel
 */
export function buildJarvisTraceabilityModel(opts = {}) {
  const { interp, rawEvent, canalLabel = 'manual' } = opts;
  const ev = rawEvent || {};
  const at = ev.at || ev.createdAt || interp?.timestamp_operativo;
  let hora = 'requiere validación';
  try {
    if (at) hora = new Date(at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    hora = String(at || 'requiere validación');
  }

  const rawOrig = String(ev.fuente || ev.canalSalida || ev.canal || canalLabel || 'manual').toLowerCase();
  let origen = String(canalLabel || 'manual');
  if (rawOrig.includes('whatsapp')) origen = 'WhatsApp';
  else if (rawOrig.includes('correo') || rawOrig.includes('outlook') || rawOrig.includes('mail')) origen = 'Correo';
  else if (rawOrig.includes('pegado') || rawOrig.includes('manual') || rawOrig.includes('hq')) origen = 'Manual';

  const cliente = pickTrace(interp?.cliente_detectado, ev.clienteDetectado);
  const responsable = pickTrace(interp?.responsable_asignado, interp?.responsable_sugerido, ev.responsableSugerido);
  const estadoActual = pickTrace(interp?.estado_operativo, ev.estado);
  const siguientePaso = pickTrace(interp?.accion_obligatoria, interp?.siguiente_paso, interp?.acciones_disponibles?.[0]);

  return {
    origen,
    hora,
    cliente,
    responsable,
    estadoActual,
    siguientePaso,
  };
}

