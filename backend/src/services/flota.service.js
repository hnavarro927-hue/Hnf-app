import { flotaRepository } from '../repositories/flota.repository.js';
import { matrizService } from './matriz.service.js';
import { auditService } from './audit.service.js';
import { messageService } from './message.service.js';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => {
    const cantidad = toNumber(item.cantidad);
    const precioUnitario = toNumber(item.precio_unitario);
    return {
      descripcion: item.descripcion || '',
      cantidad,
      precio_unitario: precioUnitario,
      total: cantidad * precioUnitario,
    };
  });

const validateStructuredOT = (data = {}) => {
  const errors = [];
  ['cliente', 'direccion', 'contacto', 'correo'].forEach((field) => {
    if (!data[field]) errors.push(`CLIENT.${field} es obligatorio.`);
  });

  ['patente', 'marca', 'modelo', 'año', 'kilometraje'].forEach((field) => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`VEHICLE.${field} es obligatorio.`);
    }
  });

  ['tipo_servicio', 'descripcion', 'fecha', 'hora_inicio', 'hora_termino', 'duracion', 'tecnico'].forEach((field) => {
    if (!data[field]) errors.push(`SERVICE.${field} es obligatorio.`);
  });

  if (!Array.isArray(data.items_servicio)) errors.push('COSTS.items_servicio debe ser array.');
  if (!Array.isArray(data.items_insumos)) errors.push('COSTS.items_insumos debe ser array.');
  if (!data.estado) errors.push('CONTROL.estado es obligatorio.');

  if (!data.cliente || !data.tecnico || !data.hora_inicio || !data.hora_termino) {
    errors.push('Regla: OT requiere cliente + tecnico + tiempo.');
  }

  return errors;
};

export const flotaService = {
  repositoryMode: flotaRepository.mode,
  getSnapshot() {
    return {
      vehiculos: flotaRepository.vehiculos,
      gestionDiaria: flotaRepository.gestionDiaria,
      ots: flotaRepository.ots,
    };
  },
  createVehiculo(data) {
    if (!data.patente || !data.marca || !data.modelo) {
      return { errors: ['Vehículo requiere patente, marca y modelo.'] };
    }
    const row = flotaRepository.createVehiculo(data);
    auditService.log('vehiculo_created', { actor: data.actor || 'Hernan', referenceId: row.id });
    return row;
  },
  createGestion(data) {
    if ((data.actor || '').toLowerCase() !== 'gery') {
      return { errors: ['Solo Gery puede crear gestión diaria.'] };
    }
    const row = flotaRepository.createGestion({ ...data, estado: data.estado || 'pendiente' });
    auditService.log('flota_gestion_created', { actor: 'Gery', referenceId: row.id });
    return row;
  },
  createOT(data) {
    const errors = validateStructuredOT(data);
    if (errors.length) {
      return { errors };
    }
    if ((data.aprobadaPor || '').toLowerCase() !== 'lyn') {
      return { errors: ['No se puede crear OT sin aprobación de Lyn.'] };
    }

    const itemsServicio = normalizeItems(data.items_servicio);
    const itemsInsumos = normalizeItems(data.items_insumos);
    const totalManoObra = itemsServicio.reduce((acc, item) => acc + item.total, 0);
    const totalInsumos = itemsInsumos.reduce((acc, item) => acc + item.total, 0);
    const totalNeto = totalManoObra + totalInsumos;

    if (totalNeto <= 0) {
      return { errors: ['Regla: OT requiere costo total mayor a 0.'] };
    }

    const ot = flotaRepository.createOT({
      numero_ot: data.numero_ot || `FL-OT-${String(flotaRepository.ots.length + 1).padStart(4, '0')}`,
      // CLIENT
      cliente: data.cliente,
      direccion: data.direccion,
      contacto: data.contacto,
      correo: data.correo,
      // VEHICLE
      patente: data.patente,
      marca: data.marca,
      modelo: data.modelo,
      año: data.año,
      kilometraje: toNumber(data.kilometraje),
      // SERVICE
      tipo_servicio: data.tipo_servicio,
      descripcion: data.descripcion,
      fecha: data.fecha,
      hora_inicio: data.hora_inicio,
      hora_termino: data.hora_termino,
      duracion: data.duracion,
      tecnico: data.tecnico,
      // COSTS auto
      items_servicio: itemsServicio,
      items_insumos: itemsInsumos,
      total_mano_obra: totalManoObra,
      total_insumos: totalInsumos,
      total_neto: totalNeto,
      // CONTROL
      estado: data.estado,
      creadoDesdeMensajeId: data.creadoDesdeMensajeId || null,
      creadoDesdeGestionId: data.creadoDesdeGestionId || null,
      // EVIDENCE
      fotos: Array.isArray(data.fotos) ? data.fotos : [],
      // meta
      aprobado_por: 'Lyn',
      actor: data.actor || 'Lyn',
    });

    matrizService.appendOperationalRow({
      modulo: 'flota',
      otId: ot.id,
      numeroOt: ot.numero_ot,
      cliente: ot.cliente,
      servicio: ot.tipo_servicio,
      fecha: ot.fecha,
      tecnico: ot.tecnico,
      total: ot.total_neto,
      estado: ot.estado,
      origen: ot.creadoDesdeGestionId ? 'gestion' : ot.creadoDesdeMensajeId ? 'mensaje' : 'manual',
    });

    if (data.creadoDesdeGestionId) {
      flotaRepository.updateGestion(data.creadoDesdeGestionId, { estado: 'convertida_ot' });
    }

    if (data.creadoDesdeMensajeId) {
      messageService.markTransition(data.creadoDesdeMensajeId, 'converted_to_OT', data.actor || 'Lyn');
      if (ot.estado === 'en_proceso') messageService.markTransition(data.creadoDesdeMensajeId, 'en_proceso', data.actor || 'Lyn');
    }

    auditService.log('flota_ot_created', { actor: data.actor || 'Lyn', referenceId: ot.id, details: { total_neto: ot.total_neto } });
    return ot;
  },
  updateOTStatus(id, data) {
    const ot = flotaRepository.ots.find((row) => row.id === id);
    if (!ot) return { error: 'OT flota no encontrada' };
    if (data.estado === 'cerrado' && (data.actor || '').toLowerCase() === 'gery') {
      return { error: 'Gery no puede cerrar OT.' };
    }
    if (['enviada', 'cerrado'].includes(data.estado) && !['lyn', 'hernan'].includes((data.actor || '').toLowerCase())) {
      return { error: 'Acción sensible requiere Lyn o Hernan.' };
    }

    const updated = flotaRepository.updateOT(id, { estado: data.estado, recibidoConforme: data.recibidoConforme ?? ot.recibidoConforme });
    if (data.creadoDesdeMensajeId && data.estado === 'terminado') {
      messageService.markTransition(data.creadoDesdeMensajeId, 'terminado', data.actor || 'system');
    }
    if (data.creadoDesdeMensajeId && data.estado === 'cerrado') {
      messageService.markTransition(data.creadoDesdeMensajeId, 'cerrado', data.actor || 'system');
    }
    auditService.log('flota_ot_status_updated', { actor: data.actor || 'system', referenceId: id, details: { estado: data.estado } });
    return updated;
  },
};
