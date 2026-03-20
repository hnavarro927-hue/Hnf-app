import { normalizeFiles } from '../middlewares/file-upload.middleware.js';
import { expenseRepository } from '../repositories/expense.repository.js';
import { validateExpensePayload } from '../validators/expense.validator.js';

export const expenseService = {
  repositoryMode: expenseRepository.mode,
  getAll() {
    return expenseRepository.findAll();
  },
  getById(id) {
    return expenseRepository.findById(id);
  },
  create(data) {
    const validation = validateExpensePayload(data);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    return expenseRepository.create({
      fecha: data.fecha,
      categoria: data.categoria,
      monto: Number(data.monto),
      descripcion: data.descripcion,
      centroCosto: data.centroCosto,
      clienteRelacionado: data.clienteRelacionado || null,
      otRelacionada: data.otRelacionada || null,
      comprobante: normalizeFiles(data, 'comprobante')[0] || null,
    });
  },
};
