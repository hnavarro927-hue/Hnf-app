import {
  getCandidatasCierre,
  getCierreMensual,
  getCierresMensuales,
  getTiendasFinancieras,
  patchTiendaFinanciera,
  postCierreCerrar,
  postCierreExcluirOt,
  postCierreIncluirOt,
  postCierreMarcarFacturado,
  postCierreMensual,
  postTiendaFinanciera,
} from '../controllers/finanzas.controller.js';

export const finanzasRoutes = [
  { method: 'GET', path: '/finanzas/tiendas', handler: getTiendasFinancieras },
  { method: 'POST', path: '/finanzas/tiendas', handler: postTiendaFinanciera },
  { method: 'PATCH', path: '/finanzas/tiendas/:id', handler: patchTiendaFinanciera },
  { method: 'GET', path: '/finanzas/cierres-mensuales', handler: getCierresMensuales },
  { method: 'GET', path: '/finanzas/cierres-mensuales/candidatas', handler: getCandidatasCierre },
  { method: 'GET', path: '/finanzas/cierres-mensuales/:id', handler: getCierreMensual },
  { method: 'POST', path: '/finanzas/cierres-mensuales', handler: postCierreMensual },
  { method: 'POST', path: '/finanzas/cierres-mensuales/:id/incluir-ot', handler: postCierreIncluirOt },
  { method: 'POST', path: '/finanzas/cierres-mensuales/:id/excluir-ot', handler: postCierreExcluirOt },
  { method: 'POST', path: '/finanzas/cierres-mensuales/:id/cerrar', handler: postCierreCerrar },
  { method: 'POST', path: '/finanzas/cierres-mensuales/:id/marcar-facturado', handler: postCierreMarcarFacturado },
];
