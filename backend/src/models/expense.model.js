export const expenseModel = {
  name: 'expense',
  fields: [
    'id',
    'fecha',
    'categoria',
    'monto',
    'descripcion',
    'centroCosto',
    'clienteRelacionado',
    'otRelacionada',
    'comprobante',
    /** registrado | aprobado | observado | rechazado — la operación no se detiene en «registrado» */
    'estadoAprobacion',
    'observacionFinanzas',
    'devolverA',
  ],
  estadoAprobacionOptions: ['registrado', 'aprobado', 'observado', 'rechazado'],
};
