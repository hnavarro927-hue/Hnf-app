import { gestionModel } from '../models/gestion.model.js';
import { gestionRepository } from '../repositories/gestion.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { validateGestionPayload } from '../validators/gestion.validator.js';
import { messageService } from './message.service.js';
import { auditService } from './audit.service.js';

export const gestionService = {
  repositoryMode: gestionRepository.mode,
  getAll() {
    return gestionRepository.findAll();
  },
  create(data) {
    const validation = validateGestionPayload(data);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    if ((data.actor || '').toLowerCase() !== 'gery') {
      return { errors: ['Solo Gery puede crear gestión desde inbox.'] };
    }

    if (data.origenMensajeId) {
      const sourceMessage = messageRepository.findById(data.origenMensajeId);
      if (!sourceMessage) {
        return { errors: ['origenMensajeId no existe en inbox.'] };
      }
      if (sourceMessage.estado !== 'approved_by_lyn') {
        return { errors: ['El mensaje debe estar aprobado por Lyn antes de convertir a gestión.'] };
      }
    }

    const row = gestionRepository.create({
      fecha: data.fecha,
      cliente: data.cliente,
      patente: data.patente,
      servicio: data.servicio,
      tipo: data.tipo,
      tecnico: data.tecnico,
      estado: data.estado || 'pendiente',
      observaciones: data.observaciones || '',
      origenMensajeId: data.origenMensajeId || null,
      creadoPor: 'Gery',
    });

    if (row.origenMensajeId) {
      messageService.markTransition(row.origenMensajeId, 'converted_to_gestion', 'Gery');
    }

    auditService.log('gestion_created', { actor: 'Gery', referenceId: row.id, details: { origenMensajeId: row.origenMensajeId } });
    return row;
  },
  updateStatus(id, estado, actor = 'system') {
    if (!gestionModel.statusOptions.includes(estado)) {
      return { error: 'Estado inválido.' };
    }

    const item = gestionRepository.updateStatus(id, estado);
    if (!item) return { error: 'Gestión no encontrada.' };
    auditService.log('gestion_status_updated', { actor, referenceId: id, details: { estado } });
    return item;
  },
};
