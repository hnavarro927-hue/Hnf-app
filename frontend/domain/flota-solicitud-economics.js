/**
 * Economía operativa Flota (frontend) — alineado a backend `flota-solicitud-economics.js`.
 */

export const TARIFA_BASE_TRASLADO_CLP = 15000;

const round2NonNeg = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

export const round2SignedMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

export function isTrasladoTipo(s) {
  return String(s?.tipoServicio ?? s?.tipo ?? '').toLowerCase() === 'traslado';
}

export function costoTotalOperativo(s) {
  return round2SignedMoney(
    round2NonNeg(s?.costoCombustible) + round2NonNeg(s?.costoPeaje) + round2NonNeg(s?.costoExterno)
  );
}

export function tarifaBaseOperativa(s) {
  return isTrasladoTipo(s) ? TARIFA_BASE_TRASLADO_CLP : 0;
}

export function utilidadOperativa(s) {
  const ct = costoTotalOperativo(s);
  const tb = tarifaBaseOperativa(s);
  if (tb > 0) return round2SignedMoney(tb - ct);
  const ing =
    round2NonNeg(s?.ingresoFinal) ||
    round2NonNeg(s?.montoCobrado) ||
    round2NonNeg(s?.monto) ||
    round2NonNeg(s?.ingresoEstimado);
  return round2SignedMoney(ing - ct);
}

/**
 * Preview en vivo: mezcla el registro previo (ingresos legacy si no es traslado) con tipo y costos del formulario.
 * @param {{ tipoServicio?: string, costoCombustible?: unknown, costoPeaje?: unknown, costoExterno?: unknown }} partial
 * @param {object} [legacy] - Solicitud actual (p. ej. sel) para ingresoFinal/monto en tipos no traslado.
 */
export function flotaEconomicsLivePreview(partial, legacy = {}) {
  const s = { ...legacy, ...partial };
  return {
    tarifaBase: tarifaBaseOperativa(s),
    costoTotal: costoTotalOperativo(s),
    utilidad: utilidadOperativa(s),
  };
}
