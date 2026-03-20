import { normalizeFiles } from '../middlewares/file-upload.middleware.js';
import { otRepository } from '../repositories/ot.repository.js';
import { validateOTPayload } from '../validators/ot.validator.js';

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

    return otRepository.create({
      cliente: data.cliente || null,
      clienteRelacionado: data.clienteRelacionado || null,
      vehiculoRelacionado: data.vehiculoRelacionado || null,
      tipoServicio: data.tipoServicio,
      tecnicoAsignado: data.tecnicoAsignado || 'Por asignar',
      estado: 'pendiente',
      fecha: data.fecha,
      observaciones: data.observaciones || '',
      fotografias: normalizeFiles(data, 'fotografias'),
    });
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
