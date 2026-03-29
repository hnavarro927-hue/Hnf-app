import { tiendaFinancieraRepository } from '../repositories/tiendaFinanciera.repository.js';

export const tiendaFinancieraService = {
  async list() {
    return tiendaFinancieraRepository.findAll();
  },
  async create(body, actor) {
    return tiendaFinancieraRepository.create(body || {}, actor);
  },
  async update(id, body, actor) {
    const u = await tiendaFinancieraRepository.update(id, body || {}, actor);
    if (!u) return { error: 'No encontrado' };
    return u;
  },
};
