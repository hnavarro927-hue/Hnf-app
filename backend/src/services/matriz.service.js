import { matrizRepository } from '../repositories/matriz.repository.js';

export const matrizService = {
  repositoryMode: matrizRepository.mode,
  getAll() {
    return matrizRepository.findAll();
  },
  appendFromOT(ot, origen) {
    return matrizRepository.create({
      modulo: 'legacy',
      otId: ot.id,
      numeroOt: ot.id,
      cliente: ot.cliente.nombre,
      servicio: ot.servicio.tipoServicio,
      fecha: ot.servicio.fecha,
      tecnico: ot.servicio.tecnico,
      total: ot.costos.totalNeto,
      estado: ot.control.estado,
      origen,
    });
  },
  appendOperationalRow(row) {
    return matrizRepository.create(row);
  },
};
