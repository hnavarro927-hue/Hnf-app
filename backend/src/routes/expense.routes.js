import { createExpense, getAllExpenses, getExpenseById } from '../controllers/expense.controller.js';

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
];
