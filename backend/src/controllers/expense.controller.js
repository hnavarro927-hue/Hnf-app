import { expenseModel } from '../models/expense.model.js';
import { expenseService } from '../services/expense.service.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getAllExpenses = async (request, response) => {
  sendSuccess(response, 200, expenseService.getAll(), {
    resource: 'expenses',
    model: expenseModel,
    repositoryMode: expenseService.repositoryMode,
  });
};

export const getExpenseById = async (request, response) => {
  const item = expenseService.getById(request.params.id);

  if (!item) {
    return sendError(response, 404, 'Gasto no encontrado.', {
      resource: 'expenses',
      expenseId: request.params.id,
    });
  }

  return sendSuccess(response, 200, item, {
    resource: 'expenses',
    action: 'getExpenseById',
  });
};

export const createExpense = async (request, response) => {
  const item = expenseService.create(request.body || {});

  if (item.errors) {
    return sendError(response, 400, 'Payload de gasto inválido.', {
      resource: 'expenses',
      validations: item.errors,
    });
  }

  sendSuccess(response, 201, item, {
    resource: 'expenses',
    action: 'createExpense',
  });
};

export const patchExpense = async (request, response) => {
  const result = expenseService.update(request.params.id, request.body || {});

  if (result.notFound) {
    return sendError(response, 404, 'Gasto no encontrado.', {
      resource: 'expenses',
      expenseId: request.params.id,
    });
  }

  if (result.errors) {
    return sendError(response, 400, 'No se pudo actualizar el gasto.', {
      resource: 'expenses',
      validations: result.errors,
    });
  }

  sendSuccess(response, 200, result.data, {
    resource: 'expenses',
    action: 'patchExpense',
  });
};
