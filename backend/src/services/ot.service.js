import { otRepository } from '../repositories/ot.repository.js';
import { validateOTPayload } from '../validators/ot.validator.js';
import { matrizService } from './matriz.service.js';

export const otService = {
  repositoryMode: otRepository.mode,
  getAll() {
    return otRepository.findAll();
  },
  create(data) {
    const validation = validateOTPayload(data);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const item = otRepository.create({
      cliente: data.cliente,
      vehiculo: data.vehiculo,
      servicio: data.servicio,
      costos: data.costos,
      evidencia: data.evidencia,
      control: data.control,
      creadoDesde: data.creadoDesde,
    });

    matrizService.appendFromOT(item, data.creadoDesde?.tipo || 'manual');
    return item;
  },
  updateStatus(id, estado, statusOptions) {
    if (!statusOptions.includes(estado)) {
      return { error: 'Estado inválido.' };
    }

    const item = otRepository.updateStatus(id, estado);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },
};
