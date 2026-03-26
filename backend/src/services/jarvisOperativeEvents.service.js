import { jarvisOperativeEventsRepository } from '../repositories/jarvisOperativeEvents.repository.js';

export const jarvisOperativeEventsService = {
  async list() {
    return jarvisOperativeEventsRepository.list();
  },

  async append(body) {
    return jarvisOperativeEventsRepository.append(body || {});
  },
};
