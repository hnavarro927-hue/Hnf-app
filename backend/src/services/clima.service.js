import { climaRepository } from '../repositories/clima.repository.js';
import { matrizService } from './matriz.service.js';
import { approvalService } from './approval.service.js';
import { auditService } from './audit.service.js';
import { messageService } from './message.service.js';

const VALID_CALENDAR_STATES = ['pendiente', 'coordinado', 'aprobado', 'ejecutado', 'reprogramado'];

export const climaService = {
  repositoryMode: climaRepository.mode,
  getSnapshot() {
    return {
      clientes: climaRepository.clientes,
      tiendas: climaRepository.tiendas,
      equipos: climaRepository.equipos,
      calendario: climaRepository.calendario,
      informes: climaRepository.informes,
      ots: climaRepository.ots,
      emergencias: climaRepository.emergencias,
    };
  },
  importTiendas(payload = {}) {
    const stores = Array.isArray(payload.stores) ? payload.stores : [];
    const mode = payload.mode || 'upsert';

    if (mode === 'replace') {
      climaRepository.tiendas.length = 0;
    }

    stores.forEach((store) => {
      const existing = climaRepository.tiendas.find((row) => row.id === store.id || row.nombreTienda === store.nombreTienda);
      if (existing) {
        Object.assign(existing, store, { version: (existing.version || 1) + 1 });
      } else {
        climaRepository.createTienda({ ...store, version: 1, vigenciaDesde: store.vigenciaDesde || new Date().toISOString().slice(0, 10) });
      }
    });

    auditService.log('clima_stores_imported', { actor: payload.actor || 'Hernan', details: { mode, count: stores.length } });
    return { updated: stores.length, total: climaRepository.tiendas.length };
  },
  createCalendario(data) {
    if (!VALID_CALENDAR_STATES.includes(data.estado || 'pendiente')) {
      return { errors: ['Estado de calendario inválido'] };
    }
    const row = climaRepository.createCalendario({ ...data, estado: data.estado || 'pendiente' });
    auditService.log('clima_schedule_created', { actor: data.actor || 'Gery', referenceId: row.id });
    return row;
  },
  createInforme(data) {
    const row = climaRepository.createInforme({ ...data, enviadoCliente: false, aprobadoInterno: false });
    auditService.log('clima_report_created', { actor: data.actor || 'tecnico', referenceId: row.id });
    return row;
  },
  createOT(data) {
    if (!data.cliente || !data.costoTotal || !data.tecnico || !data.horaInicio || !data.horaTermino) {
      return { errors: ['OT clima requiere cliente + costo + técnico + tiempo'] };
    }
    if ((data.aprobadaPor || '').toLowerCase() !== 'lyn') {
      return { errors: ['No se puede crear OT sin aprobación de Lyn.'] };
    }

    const ot = climaRepository.createOT({
      numeroOt: data.numeroOt || `CL-OT-${String(climaRepository.ots.length + 1).padStart(4, '0')}`,
      ...data,
      estado: data.estado || 'en_proceso',
      enviadoCliente: false,
      cierreAprobado: false,
    });

    matrizService.appendOperationalRow({
      modulo: 'clima',
      otId: ot.id,
      numeroOt: ot.numeroOt,
      cliente: ot.cliente,
      servicio: ot.tipoServicio,
      fecha: ot.fecha,
      tecnico: ot.tecnico,
      total: ot.costoTotal,
      estado: ot.estado,
      origen: ot.creadoDesde || 'manual',
    });

    if (data.origenMensajeId) {
      messageService.markTransition(data.origenMensajeId, 'converted_to_OT', data.actor || 'Lyn');
      if (ot.estado === 'en_proceso') messageService.markTransition(data.origenMensajeId, 'en_proceso', data.actor || 'Lyn');
    }

    auditService.log('clima_ot_created', { actor: data.actor || 'Lyn', referenceId: ot.id, details: { numeroOt: ot.numeroOt } });
    return ot;
  },
  updateOTStatus(id, data) {
    const ot = climaRepository.ots.find((row) => row.id === id);
    if (!ot) return { error: 'OT clima no encontrada' };

    if (data.estado === 'cerrado' && (data.actor || '').toLowerCase() === 'gery') {
      return { error: 'Gery no puede cerrar OT.' };
    }

    if (['enviada', 'cerrado'].includes(data.estado) && !['lyn', 'hernan'].includes((data.actor || '').toLowerCase())) {
      return { error: 'Acción sensible requiere Lyn o Hernan.' };
    }

    const updated = climaRepository.updateOT(id, { estado: data.estado, enviadoCliente: data.estado === 'enviada' ? true : ot.enviadoCliente });
    if (data.origenMensajeId && data.estado === 'terminado') {
      messageService.markTransition(data.origenMensajeId, 'terminado', data.actor || 'system');
    }
    if (data.origenMensajeId && data.estado === 'cerrado') {
      messageService.markTransition(data.origenMensajeId, 'cerrado', data.actor || 'system');
    }

    auditService.log('clima_ot_status_updated', { actor: data.actor || 'system', referenceId: id, details: { estado: data.estado } });
    return updated;
  },
};
