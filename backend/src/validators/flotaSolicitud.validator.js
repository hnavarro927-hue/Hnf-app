import { solicitudFlotaModel } from '../models/solicitudFlota.model.js';

const roundMoney = (body, key, errors) => {
  if (body[key] === undefined || body[key] === null || body[key] === '') return;
  const n = Number(body[key]);
  if (!Number.isFinite(n) || n < 0) errors.push(`${key} debe ser un número mayor o igual a 0.`);
};

export const validateSolicitudFlotaCreate = (body = {}) => {
  const errors = [];
  if (!String(body.cliente || '').trim()) errors.push('cliente es obligatorio.');
  const tipoServicio = String(body.tipoServicio || body.tipo || '').trim();
  if (!solicitudFlotaModel.tipoServicioOptions.includes(tipoServicio)) {
    errors.push(`tipoServicio inválido. Permitidos: ${solicitudFlotaModel.tipoServicioOptions.join(', ')}.`);
  }
  if (!String(body.fecha || '').trim()) errors.push('fecha es obligatoria.');
  if (!String(body.hora || '').trim()) errors.push('hora es obligatoria.');
  if (!String(body.origen || '').trim()) errors.push('origen es obligatorio.');
  if (!String(body.destino || '').trim()) errors.push('destino es obligatorio.');
  if (!String(body.conductor || '').trim()) errors.push('conductor es obligatorio.');
  if (!String(body.vehiculo || '').trim()) errors.push('vehiculo es obligatorio.');
  let estado = String(body.estado || 'recibida').trim();
  if (!solicitudFlotaModel.estados.includes(estado)) {
    errors.push(`estado inválido. Permitidos: ${solicitudFlotaModel.estados.join(', ')}.`);
  }
  [
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
  ].forEach((k) => roundMoney(body, k, errors));
  return { valid: errors.length === 0, errors };
};

export const validateSolicitudFlotaPatch = (body = {}) => {
  const errors = [];
  if (body.tipoServicio !== undefined || body.tipo !== undefined) {
    const tipoServicio = String(body.tipoServicio || body.tipo || '').trim();
    if (!solicitudFlotaModel.tipoServicioOptions.includes(tipoServicio)) {
      errors.push(`tipoServicio inválido. Permitidos: ${solicitudFlotaModel.tipoServicioOptions.join(', ')}.`);
    }
  }
  if (body.estado !== undefined) {
    const estado = String(body.estado || '').trim();
    if (!solicitudFlotaModel.estados.includes(estado)) {
      errors.push(`estado inválido. Permitidos: ${solicitudFlotaModel.estados.join(', ')}.`);
    }
  }
  [
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
  ].forEach((k) => roundMoney(body, k, errors));
  return { valid: errors.length === 0, errors };
};
