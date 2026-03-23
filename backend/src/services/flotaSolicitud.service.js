import { solicitudFlotaRepository, normalizeSolicitudShape } from '../repositories/solicitudFlota.repository.js';
import {
  validateSolicitudFlotaCreate,
  validateSolicitudFlotaPatch,
} from '../validators/flotaSolicitud.validator.js';

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
    costoCombustible: body.costoCombustible,
    costoPeaje: body.costoPeaje,
    costoChofer: body.costoChofer,
    costoExterno: body.costoExterno,
    materiales: body.materiales,
    manoObra: body.manoObra,
    costoTraslado: body.costoTraslado,
    otros: body.otros,
    ingresoEstimado: body.ingresoEstimado ?? body.monto,
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
      if (merged.costoTotal <= 0) {
        return {
          error: 'No se puede cerrar sin costos registrados (el costo total debe ser mayor que 0).',
          code: 'RULE_CERRADA_COSTOS',
        };
      }
      const obsFin = String(merged.observacionCierre || merged.observacion || '').trim();
      if (!obsFin) {
        return {
          error: 'No se puede cerrar sin observación final (completá «observación de cierre» o «observación»).',
          code: 'RULE_CERRADA_OBS',
        };
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
