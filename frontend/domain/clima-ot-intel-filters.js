import { monthRangeYmd } from './hnf-intelligence-engine.js';

export const isOtEstadoCerradaUi = (e) =>
  ['terminado', 'cerrada', 'cerrado', 'finalizada', 'facturada'].includes(String(e || '').toLowerCase());

export const roundEcon = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

export const intelFilterActiveKeys = (f) =>
  f && typeof f === 'object'
    ? Object.keys(f).filter((k) => f[k] != null && f[k] !== false && f[k] !== '')
    : [];

/** Filtros de listado Clima (misma lógica que la vista). */
export function filterOtsIntelList(list, intelListFilter) {
  if (!intelFilterActiveKeys(intelListFilter).length) return list;
  let out = list;
  if (intelListFilter.soloMesActual) {
    const { start, end } = monthRangeYmd();
    out = out.filter((o) => o.fecha >= start && o.fecha <= end);
  }
  if (intelListFilter.sinCostoTerminadas) {
    out = out.filter((o) => isOtEstadoCerradaUi(o.estado) && roundEcon(o.costoTotal) <= 0);
  }
  if (intelListFilter.sinCobroConPdf) {
    out = out.filter(
      (o) =>
        isOtEstadoCerradaUi(o.estado) &&
        o.pdfUrl &&
        String(o.pdfUrl).trim() &&
        roundEcon(o.montoCobrado) <= 0
    );
  }
  if (intelListFilter.sinPdfTerminadas) {
    out = out.filter((o) => isOtEstadoCerradaUi(o.estado) && (!o.pdfUrl || !String(o.pdfUrl).trim()));
  }
  if (intelListFilter.soloAbiertas) {
    out = out.filter((o) => !isOtEstadoCerradaUi(o.estado));
  }
  if (intelListFilter.clienteContains) {
    const q = String(intelListFilter.clienteContains).toLowerCase();
    out = out.filter((o) => String(o.cliente || '').toLowerCase().includes(q));
  }
  return out;
}
