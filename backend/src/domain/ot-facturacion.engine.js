/**
 * Reglas de facturación OT: inmediata vs mensual (mantención Clima).
 */

export function periodoYYYYMM(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function esSubtipoMantenimientoClima(subtipoServicio) {
  const s = String(subtipoServicio || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return s.includes('mantenc');
}

/** Por defecto: Flota / puntual → inmediata; Clima + mantención → mensual; resto Clima → inmediata. */
export function defaultTipoFacturacion({ tipoServicio, subtipoServicio }) {
  const t = String(tipoServicio || '').toLowerCase();
  if (t === 'flota' || t === 'comercial') return 'inmediata';
  if (t === 'clima' && esSubtipoMantenimientoClima(subtipoServicio)) return 'mensual';
  if (t === 'administrativo') return 'inmediata';
  if (t === 'clima') return 'inmediata';
  return 'inmediata';
}

/** La UI/API no debe pasar a facturada OT mensual; solo el cierre mensual (repo directo). */
export function puedeEstadoFacturadaManual(ot) {
  const tf = String(ot?.tipoFacturacion || 'inmediata').toLowerCase();
  return tf !== 'mensual';
}

export function etiquetasFacturacionUi(ot) {
  const tf = String(ot?.tipoFacturacion || 'inmediata').toLowerCase();
  const inc = Boolean(ot?.incluidaEnCierreMensual);
  const st = String(ot?.estado || '').toLowerCase();
  const facturada = st === 'facturada';
  const out = [];
  if (tf === 'mensual') {
    out.push({ key: 'mensual', label: 'Facturación mensual', tone: 'warn' });
    if (!inc && !facturada) out.push({ key: 'pend_cierre', label: 'Pendiente cierre mensual', tone: 'pending' });
  } else {
    out.push({ key: 'inmediata', label: 'Facturación inmediata', tone: 'ok' });
  }
  if (facturada) out.push({ key: 'facturada', label: 'Facturada', tone: 'done' });
  return out;
}

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

/**
 * utilidadEstimada y margenEstimadoRatio (0–1) para referencia gerencial en OT mensual.
 * No reemplaza utilidad (monto cobrado - costo).
 */
export function calcularEstimadosMensuales(ot) {
  const tf = String(ot?.tipoFacturacion || 'inmediata').toLowerCase();
  const vr = round2(Number(ot?.valorReferencialTienda ?? 0));
  const ct = round2(Number(ot?.costoTotal ?? 0));
  if (tf !== 'mensual') {
    return { utilidadEstimada: ot?.utilidadEstimada ?? null, margenEstimadoRatio: ot?.margenEstimadoRatio ?? null };
  }
  if (vr > 0) {
    const utilidadEstimada = round2(vr - ct);
    const margenEstimadoRatio = round2(utilidadEstimada / vr);
    return { utilidadEstimada, margenEstimadoRatio };
  }
  const utilidadEstimada = round2(-ct);
  return { utilidadEstimada, margenEstimadoRatio: null };
}
