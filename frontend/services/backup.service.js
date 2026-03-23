import { clientService } from './client.service.js';
import { expenseService } from './expense.service.js';
import { flotaSolicitudService } from './flota-solicitud.service.js';
import { healthService } from './health.service.js';
import { otService } from './ot.service.js';
import { planificacionService } from './planificacion.service.js';
import { vehicleService } from './vehicle.service.js';

const stamp = () => new Date().toISOString().slice(0, 19).replace(/:/g, '-');

const unwrap = async (promise) => {
  const r = await promise;
  return r?.data ?? r;
};

export const downloadJsonFile = (filename, data) => {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const meta = (module) => ({
  module,
  exportedAt: new Date().toISOString(),
  app: 'HNF',
});

export const exportBackupOtClima = async () => {
  const ots = await unwrap(otService.getAll());
  downloadJsonFile(`hnf-respaldo-ot-clima-${stamp()}.json`, {
    meta: meta('clima-ot'),
    ots: Array.isArray(ots) ? ots : [],
  });
};

export const exportBackupPlanificacionBundle = async () => {
  const [planClientes, planTiendas, planMantenciones] = await Promise.all([
    unwrap(planificacionService.getClientes()),
    unwrap(planificacionService.getTiendas({})),
    unwrap(planificacionService.getMantenciones({})),
  ]);
  downloadJsonFile(`hnf-respaldo-planificacion-clima-${stamp()}.json`, {
    meta: meta('planificacion-clima'),
    planClientes: Array.isArray(planClientes) ? planClientes : [],
    planTiendas: Array.isArray(planTiendas) ? planTiendas : [],
    planMantenciones: Array.isArray(planMantenciones) ? planMantenciones : [],
  });
};

export const exportBackupPlanClientes = async () => {
  const planClientes = await unwrap(planificacionService.getClientes());
  downloadJsonFile(`hnf-respaldo-plan-clientes-${stamp()}.json`, {
    meta: meta('plan-clientes'),
    planClientes: Array.isArray(planClientes) ? planClientes : [],
  });
};

export const exportBackupPlanTiendas = async () => {
  const planTiendas = await unwrap(planificacionService.getTiendas({}));
  downloadJsonFile(`hnf-respaldo-plan-tiendas-${stamp()}.json`, {
    meta: meta('plan-tiendas'),
    planTiendas: Array.isArray(planTiendas) ? planTiendas : [],
  });
};

export const exportBackupPlanMantenciones = async () => {
  const planMantenciones = await unwrap(planificacionService.getMantenciones({}));
  downloadJsonFile(`hnf-respaldo-plan-mantenciones-${stamp()}.json`, {
    meta: meta('plan-mantenciones'),
    planMantenciones: Array.isArray(planMantenciones) ? planMantenciones : [],
  });
};

export const exportBackupFlota = async () => {
  const flotaSolicitudes = await unwrap(flotaSolicitudService.getAll({}));
  downloadJsonFile(`hnf-respaldo-flota-solicitudes-${stamp()}.json`, {
    meta: meta('flota-solicitudes'),
    flotaSolicitudes: Array.isArray(flotaSolicitudes) ? flotaSolicitudes : [],
  });
};

export const exportBackupAdminClientes = async () => {
  const clientes = await unwrap(clientService.getAll());
  downloadJsonFile(`hnf-respaldo-admin-clientes-${stamp()}.json`, {
    meta: meta('admin-clientes'),
    clientes: Array.isArray(clientes) ? clientes : [],
  });
};

export const exportBackupCompleto = async () => {
  const [
    health,
    ots,
    planClientes,
    planTiendas,
    planMantenciones,
    flotaSolicitudes,
    clientes,
    vehicles,
    expenses,
  ] = await Promise.all([
    unwrap(healthService.getStatus()),
    unwrap(otService.getAll()),
    unwrap(planificacionService.getClientes()),
    unwrap(planificacionService.getTiendas({})),
    unwrap(planificacionService.getMantenciones({})),
    unwrap(flotaSolicitudService.getAll({})),
    unwrap(clientService.getAll()),
    unwrap(vehicleService.getAll()),
    unwrap(expenseService.getAll()),
  ]);

  downloadJsonFile(`hnf-respaldo-completo-${stamp()}.json`, {
    meta: {
      ...meta('completo'),
      note: 'Respaldo de lectura: OT, planificación clima, flota, clientes admin, vehículos y gastos.',
    },
    health: health ?? null,
    ots: Array.isArray(ots) ? ots : [],
    planificacion: {
      clientes: Array.isArray(planClientes) ? planClientes : [],
      tiendas: Array.isArray(planTiendas) ? planTiendas : [],
      mantenciones: Array.isArray(planMantenciones) ? planMantenciones : [],
    },
    flotaSolicitudes: Array.isArray(flotaSolicitudes) ? flotaSolicitudes : [],
    administracion: {
      clientes: Array.isArray(clientes) ? clientes : [],
      vehicles: Array.isArray(vehicles) ? vehicles : [],
      expenses: Array.isArray(expenses) ? expenses : [],
    },
  });
};
