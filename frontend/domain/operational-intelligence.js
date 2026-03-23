/**
 * Capa de contexto operativo HNF — preparada para automatización / IA futura.
 *
 * Contrato: solo funciones puras y JSON serializable. Sin fetch, sin DOM.
 * Consumidores previstos: asistente interno, jobs de validación, integraciones.
 *
 * @module domain/operational-intelligence
 */

import {
  formatAllCloseBlockersMessage,
  getEvidenceGaps,
  getQualityCloseGaps,
  otCanClose,
} from '../utils/ot-evidence.js';
import { flotaNextEstado, FLOTA_ESTADO_LABELS } from '../constants/flotaPipeline.js';

export const OPERATIONAL_CONTEXT_SCHEMA = 'hnf.operationalContext';
export const OPERATIONAL_CONTEXT_VERSION = '2025-03-23';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

/**
 * Brief estructurado de una OT Clima para cierre y seguimiento.
 * @param {object} ot - OT desde backend / caché
 * @param {{ economicsSaved?: boolean }} [options]
 */
export function buildOtOperationalBrief(ot, options = {}) {
  const economicsSaved = Boolean(options.economicsSaved);
  const evidenceGaps = ot ? getEvidenceGaps(ot) : [];
  const qualityGaps = ot ? getQualityCloseGaps(ot) : [];
  const mc = roundMoney(ot?.montoCobrado);
  const ct = roundMoney(ot?.costoTotal);
  const economicsValid = mc > 0 && ct > 0;

  const blockers = [];
  for (const g of evidenceGaps) {
    blockers.push({
      code: 'EVIDENCE_GAP',
      severity: 'block',
      detail: g.scope === 'OT' ? `Foto ${g.blockLabel} (visita general)` : `Foto ${g.blockLabel} · ${g.equipo}`,
    });
  }
  for (const g of qualityGaps) {
    blockers.push({
      code: g.kind === 'checklist' ? 'CHECKLIST' : 'VISIT_TEXT',
      severity: 'block',
      detail: g.text,
    });
  }
  if (ot?.estado !== 'terminado' && !economicsSaved) {
    blockers.push({
      code: 'ECONOMICS_NOT_PERSISTED',
      severity: 'block',
      detail: 'Resultado económico no guardado en servidor o pendiente de guardar.',
    });
  } else if (ot?.estado !== 'terminado' && !economicsValid) {
    blockers.push({
      code: 'ECONOMICS_INVALID',
      severity: 'block',
      detail: 'Monto cobrado y costo total deben ser mayores que cero en servidor.',
    });
  }

  const suggestedActions = [];
  if (evidenceGaps.length) suggestedActions.push({ action: 'UPLOAD_EVIDENCE', label: 'Completar evidencias por equipo/bloque' });
  if (qualityGaps.some((g) => g.kind === 'ot')) {
    suggestedActions.push({ action: 'SAVE_VISIT_TEXT', label: 'Guardar resumen y recomendaciones de visita' });
  }
  if (qualityGaps.some((g) => g.kind === 'checklist')) {
    suggestedActions.push({ action: 'COMPLETE_CHECKLIST', label: 'Marcar checklist en equipos' });
  }
  if (!economicsSaved && ot?.estado !== 'terminado') {
    suggestedActions.push({ action: 'SAVE_ECONOMICS', label: 'Guardar resultado económico' });
  }
  if (otCanClose(ot) && economicsSaved && economicsValid && ot?.estado !== 'terminado') {
    suggestedActions.push({ action: 'CLOSE_OT', label: 'Cerrar OT e informe final' });
  }

  return {
    schema: OPERATIONAL_CONTEXT_SCHEMA,
    version: OPERATIONAL_CONTEXT_VERSION,
    domain: 'clima-ot',
    entity: { type: 'ot', id: ot?.id ?? null },
    estado: ot?.estado ?? null,
    flags: {
      canClose: Boolean(ot && otCanClose(ot)),
      economicsPersistedValid: economicsSaved && economicsValid,
      hasPdf: Boolean(ot?.pdfUrl && String(ot.pdfUrl).trim()),
    },
    blockers,
    suggestedActions,
    humanSummary: ot ? formatAllCloseBlockersMessage(ot) : '',
  };
}

const asignadoReal = (v) => {
  const t = String(v ?? '').trim();
  return t.length > 0 && t.toLowerCase() !== 'por asignar' && t !== '—';
};

const flotaSumCostos = (s) => {
  const r = (x) => roundMoney(x);
  return r(
    r(s?.costoCombustible) +
      r(s?.costoPeaje) +
      r(s?.costoChofer) +
      r(s?.costoExterno) +
      r(s?.materiales) +
      r(s?.manoObra) +
      r(s?.costoTraslado) +
      r(s?.otros)
  );
};

/**
 * Brief de solicitud flota para avance y cierre.
 */
export function buildFlotaOperationalBrief(solicitud) {
  const s = solicitud || {};
  const estado = s.estado || 'recibida';
  const next = flotaNextEstado(estado);
  const blockers = [];
  const suggestedActions = [];

  if (next === 'en_ruta') {
    if (!asignadoReal(s.conductor) || !asignadoReal(s.vehiculo)) {
      blockers.push({
        code: 'EN_RUTA_ASSIGNMENT',
        severity: 'block',
        detail: 'Conductor y vehículo deben ser reales (no «Por asignar»).',
      });
    }
  }
  if (next === 'cerrada') {
    const total = flotaSumCostos(s);
    const obs = String(s.observacionCierre || s.observacion || '').trim();
    if (total <= 0) {
      blockers.push({
        code: 'CERRADA_COSTOS',
        severity: 'block',
        detail: 'Costo total debe ser mayor que cero (guardá datos en servidor).',
      });
    }
    if (!obs) {
      blockers.push({
        code: 'CERRADA_OBSERVACION',
        severity: 'block',
        detail: 'Observación de cierre u observación general obligatoria.',
      });
    }
  }

  if (next) {
    suggestedActions.push({
      action: 'ADVANCE_STATE',
      label: `Avanzar a «${FLOTA_ESTADO_LABELS[next] || next}»`,
      payload: { estado: next },
    });
  }
  suggestedActions.push({ action: 'SAVE_SOLICITUD', label: 'Guardar datos del formulario' });

  return {
    schema: OPERATIONAL_CONTEXT_SCHEMA,
    version: OPERATIONAL_CONTEXT_VERSION,
    domain: 'flota-solicitud',
    entity: { type: 'flotaSolicitud', id: s.id ?? null },
    estado,
    nextEstado: next,
    flags: {
      isTerminal: estado === 'cerrada',
      costoTotal: flotaSumCostos(s),
    },
    blockers,
    suggestedActions,
  };
}

/**
 * Serialización estable para prompts o logs (sin funciones).
 */
export function serializeOperationalBrief(brief) {
  return JSON.stringify(brief);
}
