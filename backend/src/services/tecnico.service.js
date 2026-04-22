import { tecnicoRepository } from '../repositories/tecnico.repository.js';

export const tecnicoService = {
  repositoryMode: tecnicoRepository.mode,
  getAll() {
    return tecnicoRepository.findAll();
  },
  create(data) {
    if (!data.nombre || !data.unidad) {
      return { errors: ['nombre y unidad son obligatorios'] };
    }
    return tecnicoRepository.create({ nombre: data.nombre, unidad: data.unidad, activo: data.activo !== false });
  },
};
