/**
 * Economía operativa estándar HNF · solicitudes Flota (traslado = tarifa fija − costos directos).
 * Costo total operativo = combustible + peaje + externo (legacy fields no suman al total).
 */

export const TARIFA_BASE_TRASLADO_CLP = 15000;

const round2NonNeg = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(Math.max(0, v) * 100) / 100;
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

export const round2SignedMoney = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

export function isTrasladoTipo(s) {
  return String(s?.tipoServicio ?? s?.tipo ?? '').toLowerCase() === 'traslado';
}

/** Suma única autorizada para costo_total operativo. */
export function costoTotalOperativo(s) {
  return round2SignedMoney(
    round2NonNeg(s?.costoCombustible) + round2NonNeg(s?.costoPeaje) + round2NonNeg(s?.costoExterno)
  );
}

export function tarifaBaseOperativa(s) {
  return isTrasladoTipo(s) ? TARIFA_BASE_TRASLADO_CLP : 0;
}

/**
 * Traslado: tarifa_base − costo_total. Otros tipos: ingreso legacy − costo_total (compatibilidad).
 */
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
