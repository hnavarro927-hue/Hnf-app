/**
 * Umbrales de tiempo y alertas operativas (cliente; sin backend nuevo).
 */

export const HNF_TIMING_RULES_VERSION = '2026-03-27-v1';

export const THRESHOLDS = {
  urgentSinTecnicoHoras: 4,
  solicitudSinRespuestaDias: 3,
  ejecucionLargaDias: 7,
  permisoCorreoHoras: 24,
};

function parseMs(ot) {
  const fecha = String(ot?.fecha || '').trim();
  if (!fecha) return null;
  const h = String(ot?.hora || '09:00').match(/^(\d{1,2}):(\d{2})/);
  const hh = h ? `${h[1].padStart(2, '0')}:${h[2]}` : '09:00';
  const t = new Date(`${fecha}T${hh}:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

function tecnicoSinAsignar(ot) {
  const t = String(ot?.tecnicoAsignado || '').trim().toLowerCase();
  return !t || t === 'sin asignar' || t === 'por asignar';
}

function isUrgentText(ot) {
  const b = `${ot?.observaciones || ''} ${ot?.subtipoServicio || ''}`.toLowerCase();
  return /\burgent|emergencia|crític|critico\b/i.test(b);
}

/**
 * @param {object[]} ots
 */
export function buildTimingAlerts(ots) {
  const list = Array.isArray(ots) ? ots : [];
  const now = Date.now();
  const alerts = [];

  for (const ot of list) {
    const st = String(ot?.estado || '').toLowerCase();
    if (['terminado', 'cerrado', 'cancelado'].includes(st)) continue;
    const ms = parseMs(ot);
    if (ms == null) continue;
    const ageH = (now - ms) / 3600000;
    const ageD = ageH / 24;

    if (isUrgentText(ot) && tecnicoSinAsignar(ot) && ageH > THRESHOLDS.urgentSinTecnicoHoras) {
      alerts.push({
        code: 'URG_SIN_TEC',
        severity: 'alta',
        text: `OT ${ot.id}: urgencia declarada sin técnico > ${THRESHOLDS.urgentSinTecnicoHoras} h.`,
      });
    }

    if (['pendiente', 'nueva', 'abierta'].includes(st) && ageD > THRESHOLDS.solicitudSinRespuestaDias) {
      alerts.push({
        code: 'SOLIC_LENTA',
        severity: 'media',
        text: `OT ${ot.id}: solicitud abierta > ${THRESHOLDS.solicitudSinRespuestaDias} días sin avance claro.`,
      });
    }

    if (['en proceso', 'proceso', 'visita', 'ejecucion', 'ejecución'].some((x) => st.includes(x)) && ageD > THRESHOLDS.ejecucionLargaDias) {
      alerts.push({
        code: 'EJEC_LARGA',
        severity: 'media',
        text: `OT ${ot.id}: en ejecución > ${THRESHOLDS.ejecucionLargaDias} días; revisar bloqueo o cierre parcial.`,
      });
    }
  }

  return { alerts, thresholds: THRESHOLDS };
}
