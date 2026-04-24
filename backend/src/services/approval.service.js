import { approvalRepository } from '../repositories/approval.repository.js';
import { auditService } from './audit.service.js';

const approvers = new Set(['lyn', 'hernan']);

export const approvalService = {
  repositoryMode: approvalRepository.mode,
  getAll() {
    return approvalRepository.findAll();
  },
  requestApproval(data) {
    const row = approvalRepository.create({
      referenciaTipo: data.referenciaTipo,
      referenciaId: data.referenciaId,
      accion: data.accion,
      solicitadoPor: data.solicitadoPor || 'sistema',
      estado: 'pendiente',
      comentario: data.comentario || '',
    });
    auditService.log('approval_requested', { actor: data.solicitadoPor || 'sistema', referenceId: row.id, details: { referenciaId: data.referenciaId } });
    return row;
  },
  decide(id, data) {
    if (!approvers.has((data.aprobador || '').toLowerCase())) {
      return { error: 'Solo Lyn o Hernan pueden aprobar/rechazar.' };
    }
    if (!['aprobado', 'rechazado'].includes(data.estado)) {
      return { error: 'Estado de decisión inválido.' };
    }

    const item = approvalRepository.decide(id, {
      estado: data.estado,
      aprobador: data.aprobador,
      comentario: data.comentario || '',
      fechaDecision: new Date().toISOString(),
    });

    if (!item) return { error: 'Solicitud no encontrada.' };
    auditService.log('approval_decided', { actor: data.aprobador, referenceId: id, details: { estado: data.estado } });
    return item;
  },
};
