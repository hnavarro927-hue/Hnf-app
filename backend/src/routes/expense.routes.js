import { createExpense, getAllExpenses, getExpenseById, patchExpense } from '../controllers/expense.controller.js';

export const expenseRoutes = [
  {
    method: 'GET',
    path: '/expenses',
    handler: getAllExpenses,
  },
  {
    method: 'GET',
    path: '/expenses/:id',
    handler: getExpenseById,
  },
  {
    method: 'POST',
    path: '/expenses',
    handler: createExpense,
  },
  {
    method: 'PATCH',
    path: '/expenses/:id',
    handler: patchExpense,
  },
];
