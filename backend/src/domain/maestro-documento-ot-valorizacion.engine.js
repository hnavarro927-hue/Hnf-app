/**
 * Clasificación de tipo de servicio OT y valorización estimada desde intake (tipo_solicitud_inferida).
 */

import { normalizeDestinoModulo } from './maestro-document-destino.engine.js';

function normTipoSolicitud(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function tipoServicioOtDesdeTipoSolicitudInferida(tipoSolicitudInferida, destinoFallback) {
  const ts = normTipoSolicitud(tipoSolicitudInferida);
  if (ts === 'traslado') return 'flota';
  if (ts === 'mantencion') return 'clima';
  if (ts === 'revision') return 'clima';
  const d = normalizeDestinoModulo(destinoFallback);
  if (d === 'flota') return 'flota';
  if (d === 'comercial' || d === 'administrativo') return d;
  return 'clima';
}

export function subtipoServicioDesdeTipoSolicitud(tipoSolicitudInferida) {
  const ts = normTipoSolicitud(tipoSolicitudInferida);
  if (ts === 'traslado') return 'Traslado / logística';
  if (ts === 'mantencion') return 'Mantención';
  if (ts === 'revision') return 'Revisión técnica';
  return 'Gestión documento Base Maestra';
}

export function valorizacionOtDesdeTipoSolicitud(tipoSolicitudInferida) {
  const ts = normTipoSolicitud(tipoSolicitudInferida);
  const traslado = Number(process.env.HNF_OT_VALOR_TRASLADO_CLP);
  const revision = Number(process.env.HNF_OT_VALOR_REVISION_CLP);
  const mantBase = Number(process.env.HNF_OT_VALOR_MANTENCION_BASE_CLP);
  const costoMant = Number(process.env.HNF_OT_COSTO_MANTENCION_BASE_CLP);

  const montoTraslado = Number.isFinite(traslado) && traslado > 0 ? traslado : 15000;
  const montoRevision = Number.isFinite(revision) && revision > 0 ? revision : 15000;
  const montoMant = Number.isFinite(mantBase) && mantBase > 0 ? mantBase : 35000;

  let montoEstimado = montoRevision;
  let margenEstimado = null;

  if (ts === 'traslado') {
    montoEstimado = montoTraslado;
  } else if (ts === 'mantencion') {
    montoEstimado = montoMant;
    if (Number.isFinite(costoMant) && costoMant >= 0) {
      margenEstimado = Math.round((montoMant - costoMant) * 100) / 100;
    }
  } else if (ts === 'revision') {
    montoEstimado = montoRevision;
  }

  return { montoEstimado, margenEstimado };
}

export function otAutoDesdeDocumentoHabilitado() {
  const e = String(process.env.HNF_OT_AUTO_DESDE_DOCUMENTO || '').toLowerCase().trim();
  return e !== '0' && e !== 'false' && e !== 'no';
}
