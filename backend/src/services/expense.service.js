import { normalizeFiles } from '../middlewares/file-upload.middleware.js';
import { expenseRepository } from '../repositories/expense.repository.js';
import { validateExpensePatch, validateExpensePayload } from '../validators/expense.validator.js';

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
      estadoAprobacion: 'registrado',
      observacionFinanzas: data.observacionFinanzas != null ? String(data.observacionFinanzas).trim() || null : null,
      devolverA: data.devolverA != null ? String(data.devolverA).trim() || null : null,
    });
  },
  update(id, body = {}) {
    const existing = expenseRepository.findById(id);
    if (!existing) {
      return { notFound: true };
    }
    const next = {
      ...existing,
      estadoAprobacion: existing.estadoAprobacion || 'registrado',
    };
    if (body.estadoAprobacion != null) {
      next.estadoAprobacion = String(body.estadoAprobacion).trim().toLowerCase();
    }
    if (body.observacionFinanzas !== undefined) {
      next.observacionFinanzas = String(body.observacionFinanzas || '').trim() || null;
    }
    if (body.devolverA !== undefined) {
      next.devolverA = String(body.devolverA || '').trim() || null;
    }
    const v = validateExpensePatch(next);
    if (!v.valid) {
      return { errors: v.errors };
    }
    const saved = expenseRepository.update(id, next);
    return { ok: true, data: saved };
  },
};
