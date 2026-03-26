import { getEvidenceGaps } from '../../utils/ot-evidence.js';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

/**
 * Impacto económico consolidado para el centro de mando (solo lectura de estado).
 * @param {object} unified
 */
export function computeJarvisCash(unified) {
  const cr = unified?.jarvisFrictionPressure?.capaRealidad || {};
  const bloqueado = roundMoney(cr.ingresoBloqueado);
  const fugaReportada = roundMoney(cr.fugaDinero);
  const planOts = Array.isArray(unified?.planOts) ? unified.planOts : [];
  const openOts = planOts.filter((o) => String(o?.estado || '') !== 'terminado');
  const now = Date.now();
  const msDay = 86400000;

  let riesgoEvidencia = 0;
  let riesgoAntiguedad = 0;
  let recuperableHoy = 0;

  for (const ot of openOts) {
    const gaps = getEvidenceGaps(ot);
    const m = roundMoney(ot.montoCobrado) || roundMoney(ot.estimacionMonto) || roundMoney(ot.monto);
    if (gaps.length) {
      riesgoEvidencia += m > 0 ? m : 0;
    } else {
      recuperableHoy += m;
    }
    const ts = ot?.updatedAt || ot?.fechaVisita || ot?.createdAt;
    const t = ts ? new Date(ts).getTime() : now;
    if (now - t > 7 * msDay) {
      riesgoAntiguedad += m > 0 ? m : roundMoney(cr.ingresoProyectado) / Math.max(1, openOts.length);
    }
  }

  const riesgo_total = Math.round(bloqueado + riesgoEvidencia + riesgoAntiguedad * 0.25);
  const recuperable_hoy = Math.round(recuperableHoy);
  const fuga_estimada = Math.round(fugaReportada + riesgoAntiguedad * 0.12);

  let prioridad = 'BAJA';
  if (riesgo_total > 500000) prioridad = 'CRITICA';
  else if (riesgo_total > 150000) prioridad = 'ALTA';
  else if (riesgo_total > 40000) prioridad = 'MEDIA';

  return {
    riesgo_total,
    recuperable_hoy,
    fuga_estimada,
    prioridad,
  };
}
