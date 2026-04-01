import { solicitudFlotaRepository, normalizeSolicitudShape } from '../repositories/solicitudFlota.repository.js';
import {
  validateSolicitudFlotaCreate,
  validateSolicitudFlotaPatch,
} from '../validators/flotaSolicitud.validator.js';

const MSG_CIERRE_OT_FLOTA =
  'Debes completar costos y observación antes de cerrar la OT';

const PATCH_KEYS = [
  'cliente',
  'tipoServicio',
  'tipo',
  'fecha',
  'hora',
  'origen',
  'destino',
  'conductor',
  'vehiculo',
  'estado',
  'detalle',
  'responsable',
  'observacion',
  'observacionCierre',
  'costoCombustible',
  'costoPeaje',
  'costoChofer',
  'costoExterno',
  'materiales',
  'manoObra',
  'costoTraslado',
  'otros',
  'ingresoEstimado',
  'ingresoFinal',
  'montoCobrado',
  'monto',
];

const asignadoReal = (v) => {
  const t = String(v || '').trim();
  return t.length > 0 && t.toLowerCase() !== 'por asignar' && t !== '—';
};

const buildCreatePayload = (body) => {
  const tipoServicio = String(body.tipoServicio || body.tipo || 'traslado').trim();
  return {
    cliente: String(body.cliente || '').trim(),
    tipoServicio,
    fecha: String(body.fecha || '').trim(),
    hora: String(body.hora || '').trim(),
    origen: String(body.origen || '').trim(),
    destino: String(body.destino || '').trim(),
    conductor: String(body.conductor || '').trim(),
    vehiculo: String(body.vehiculo || '').trim(),
    estado: String(body.estado || 'recibida').trim(),
    detalle: String(body.detalle ?? '').trim(),
    responsable: String(body.responsable ?? '').trim(),
    observacion: String(body.observacion ?? '').trim(),
    observacionCierre: String(body.observacionCierre ?? '').trim(),
    costoCombustible: body.costoCombustible ?? 0,
    costoPeaje: body.costoPeaje ?? 0,
    costoChofer: body.costoChofer ?? 0,
    costoExterno: body.costoExterno ?? 0,
    materiales: body.materiales ?? 0,
    manoObra: body.manoObra ?? 0,
    costoTraslado: body.costoTraslado ?? 0,
    otros: body.otros ?? 0,
    ingresoEstimado: body.ingresoEstimado,
    ingresoFinal: body.ingresoFinal,
    montoCobrado: body.montoCobrado,
    monto: body.monto,
  };
};

export const flotaSolicitudService = {
  async list(filters = {}) {
    return solicitudFlotaRepository.findAll(filters);
  },

  async create(body, actor = 'sistema') {
    const v = validateSolicitudFlotaCreate(body);
    if (!v.valid) return { errors: v.errors };
    return solicitudFlotaRepository.create(buildCreatePayload(body), actor);
  },

  async patch(id, body, actor = 'sistema') {
    const v = validateSolicitudFlotaPatch(body);
    if (!v.valid) return { errors: v.errors };
    const current = await solicitudFlotaRepository.findById(id);
    if (!current) return { error: 'Solicitud no encontrada.' };

    const patch = {};
    for (const k of PATCH_KEYS) {
      if (k in body) patch[k] = body[k];
    }
    if ('tipo' in body && !('tipoServicio' in body)) {
      patch.tipoServicio = body.tipo;
    }
    if (!Object.keys(patch).length) {
      return current;
    }

    const merged = normalizeSolicitudShape({ ...current, ...patch });
    const targetEstado = patch.estado !== undefined ? merged.estado : current.estado;

    if (targetEstado === 'en_ruta') {
      if (!asignadoReal(merged.conductor) || !asignadoReal(merged.vehiculo)) {
        return {
          error:
            'No se puede pasar a «en ruta» sin conductor y vehículo reales asignados (no uses «Por asignar»).',
          code: 'RULE_EN_RUTA',
        };
      }
    }

    if (targetEstado === 'cerrada') {
      if (!asignadoReal(merged.conductor) || !asignadoReal(merged.vehiculo)) {
        return { error: MSG_CIERRE_OT_FLOTA, code: 'RULE_CERRADA_ASIGNACION' };
      }
      if (merged.costoTotal <= 0) {
        return { error: MSG_CIERRE_OT_FLOTA, code: 'RULE_CERRADA_COSTOS' };
      }
      if (!String(merged.observacionCierre || '').trim()) {
        return { error: MSG_CIERRE_OT_FLOTA, code: 'RULE_CERRADA_OBS' };
      }
    }

    const histParts = [];
    if (patch.estado !== undefined) histParts.push(`estado → ${patch.estado}`);
    if (patch.conductor !== undefined) histParts.push('conductor actualizado');
    if (patch.vehiculo !== undefined) histParts.push('vehículo actualizado');
    const detalle = histParts.length ? histParts.join(' · ') : 'Actualización de datos';

    return solicitudFlotaRepository.update(id, patch, { accion: 'edicion', detalle }, actor);
  },
};
