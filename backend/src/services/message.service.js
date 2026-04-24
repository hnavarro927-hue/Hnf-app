import { messageModel } from '../models/message.model.js';
import { messageRepository } from '../repositories/message.repository.js';
import { validateMessagePayload } from '../validators/message.validator.js';
import { auditService } from './audit.service.js';

const allowedTransitions = {
  nuevo: ['reviewed_by_gery'],
  reviewed_by_gery: ['approved_by_lyn'],
  approved_by_lyn: ['converted_to_gestion'],
  converted_to_gestion: ['converted_to_OT'],
  converted_to_OT: ['en_proceso'],
  en_proceso: ['terminado'],
  terminado: ['cerrado'],
  cerrado: [],
};

export const messageService = {
  repositoryMode: messageRepository.mode,
  getAll() {
    return messageRepository.findAll();
  },
  create(data) {
    const validation = validateMessagePayload(data);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const row = messageRepository.create({
      fuente: data.fuente,
      remitente: data.remitente,
      nombre: data.nombre,
      mensaje: data.mensaje,
      fechaHora: data.fechaHora || new Date().toISOString(),
      estado: 'nuevo',
      clasificacion: null,
      reviewedBy: null,
    });

    auditService.log('message_created', { actor: data.actor || 'system', referenceId: row.id });
    return row;
  },
  reviewByGery(id, payload) {
    const item = messageRepository.findById(id);
    if (!item) return { error: 'Mensaje no encontrado.' };
    if ((payload.actor || '').toLowerCase() !== 'gery') return { error: 'Solo Gery puede revisar y clasificar mensajes.' };
    if (!allowedTransitions[item.estado]?.includes('reviewed_by_gery')) return { error: `Transición inválida desde ${item.estado}.` };

    const updated = messageRepository.update(id, {
      estado: 'reviewed_by_gery',
      clasificacion: payload.clasificacion || 'flota',
      reviewedBy: 'Gery',
    });
    auditService.log('message_reviewed_by_gery', { actor: 'Gery', referenceId: id, details: { clasificacion: updated.clasificacion } });
    return updated;
  },
  approveByLyn(id, payload) {
    const item = messageRepository.findById(id);
    if (!item) return { error: 'Mensaje no encontrado.' };
    if ((payload.actor || '').toLowerCase() !== 'lyn') return { error: 'Solo Lyn puede aprobar mensajes.' };
    if (!allowedTransitions[item.estado]?.includes('approved_by_lyn')) return { error: `Transición inválida desde ${item.estado}.` };

    const updated = messageRepository.update(id, { estado: 'approved_by_lyn' });
    auditService.log('message_approved_by_lyn', { actor: 'Lyn', referenceId: id });
    return updated;
  },
  markTransition(id, estado, actor = 'system') {
    const item = messageRepository.findById(id);
    if (!item) return { error: 'Mensaje no encontrado.' };
    if (!messageModel.statusOptions.includes(estado)) return { error: 'Estado inválido.' };
    if (!allowedTransitions[item.estado]?.includes(estado)) return { error: `Transición inválida desde ${item.estado} a ${estado}.` };

    const updated = messageRepository.update(id, { estado });
    auditService.log('message_transition', { actor, referenceId: id, details: { to: estado } });
    return updated;
  },
};
