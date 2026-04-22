import { auditRepository } from '../repositories/audit.repository.js';

export const auditService = {
  repositoryMode: auditRepository.mode,
  getAll() {
    return auditRepository.findAll();
  },
  log(action, payload = {}) {
    return auditRepository.create({ action, ...payload });
  },
};
