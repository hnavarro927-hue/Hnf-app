import { OPPORTUNITY_VALUE_BASES } from '../config/commercialOpportunity.defaults.js';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Reglas alineadas con frontend `detectCommercialOpportunities` (technical-document-intelligence.js).
 */
export function detectCommercialOpportunitiesFromDoc(doc) {
  const d = doc || {};
  const out = [];
  const obs = String(d.observacionesTecnicas || '');
  const rec = String(d.recomendaciones || '').trim();
  const recN = norm(rec);
  const tipoM = norm(d.tipoMantencion);
  const ingest = Array.isArray(d.alertasIngesta) ? d.alertasIngesta : [];
  const critIngest = ingest.filter((a) => String(a.nivel || '').toLowerCase() === 'critico');

  const obsCrit =
    critIngest.length > 0 ||
    /\b(fuga|escape|perdida de refrigerante|urgente|critico)\b/i.test(obs) ||
    (norm(obs).includes('fuga') && norm(obs).includes('refriger'));

  if (obsCrit) {
    const msg = critIngest.map((x) => x.mensaje).filter(Boolean)[0];
    out.push({
      regla: 'riesgo_critico',
      tipoServicio: 'urgencia',
      prioridad: 'alta',
      descripcion: msg || 'Riesgo operativo crítico detectado en el informe técnico.',
    });
  }

  if (rec.length > 35) {
    out.push({
      regla: 'recomendaciones',
      tipoServicio: 'mejora',
      prioridad: out.some((x) => x.prioridad === 'alta') ? 'media' : 'media',
      descripcion: `Oportunidad por recomendaciones: ${rec.slice(0, 240)}${rec.length > 240 ? '…' : ''}`,
    });
  }

  if (tipoM.includes('prevent') || /\b(recurrente|mensual|contrato am|plan de mant)\b/.test(norm(`${d.resumenEjecutivo} ${obs} ${rec}`))) {
    out.push({
      regla: 'mantenimiento_recurrente',
      tipoServicio: 'mantenimiento',
      prioridad: 'baja',
      descripcion: 'Mantención recurrente / preventiva: potencial contrato o visitas programadas.',
    });
  }

  if (
    tipoM.includes('correct') ||
    recN.includes('repar') ||
    recN.includes('reemplaz') ||
    recN.includes('sustitu')
  ) {
    out.push({
      regla: 'reparacion',
      tipoServicio: 'reparacion',
      prioridad: out.some((x) => x.tipoServicio === 'urgencia') ? 'media' : 'media',
      descripcion: 'Línea correctiva / reparación o reemplazo sugerido en el informe.',
    });
  }

  const seen = new Set();
  return out.filter((row) => {
    const k = `${row.regla}:${row.tipoServicio}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function estimateOpportunityValue(opportunity) {
  const t = String(opportunity?.tipoServicio || '').toLowerCase();
  const base = OPPORTUNITY_VALUE_BASES[t] || OPPORTUNITY_VALUE_BASES.mejora;
  return {
    monto: Number(base.monto) || 0,
    etiqueta: base.etiqueta || '',
  };
}

export function buildOpportunityRowsForDocument(doc, actor) {
  const d = doc || {};
  const detected = detectCommercialOpportunitiesFromDoc(d);
  const now = new Date().toISOString();
  const cliente = String(d.cliente || '').trim() || '—';
  const tid = String(d.id || '').trim();

  return detected.map((x) => {
    const { monto, etiqueta } = estimateOpportunityValue(x);
    return {
      technicalDocumentId: tid,
      cliente,
      tipoServicio: x.tipoServicio,
      descripcion: x.descripcion,
      prioridad: x.prioridad,
      estimacionMonto: monto,
      estimacionEtiqueta: etiqueta,
      estado: 'pendiente',
      fechaCreacion: now,
      origen: 'automatico',
      regla: x.regla,
      updatedAt: now,
      updatedBy: String(actor || 'sistema').slice(0, 80),
    };
  });
}
