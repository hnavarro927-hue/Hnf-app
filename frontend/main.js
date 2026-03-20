import { appConfig } from './config/app.config.js';
import { createShell } from './components/shell.js';
import { clientService } from './services/client.service.js';
import { expenseService } from './services/expense.service.js';
import { healthService } from './services/health.service.js';
import { otService } from './services/ot.service.js';
import { vehicleService } from './services/vehicle.service.js';
import { dashboardView } from './views/dashboard.js';
import { climaView } from './views/clima.js';
import { flotaView } from './views/flota.js';
import { adminView } from './views/admin.js';

const app = document.querySelector('#app');

const viewRegistry = {
  dashboard: {
    render: dashboardView,
    load: async () => {
      const [health, ots, clients, vehicles, expenses] = await Promise.all([
        healthService.getStatus(),
        otService.getAll(),
        clientService.getAll(),
        vehicleService.getAll(),
        expenseService.getAll(),
      ]);

      return { health, ots, clients, vehicles, expenses };
    },
  },
  clima: {
    render: climaView,
    load: () => otService.getAll(),
  },
  flota: {
    render: flotaView,
    load: async () => {
      const [vehicles, expenses] = await Promise.all([
        vehicleService.getAll(),
        expenseService.getAll(),
      ]);

      return { vehicles, expenses };
    },
  },
  admin: {
    render: adminView,
    load: async () => {
      const [clients, ots, expenses] = await Promise.all([
        clientService.getAll(),
        otService.getAll(),
        expenseService.getAll(),
      ]);

      return { clients, ots, expenses };
    },
  },
};

const state = {
  activeView: 'dashboard',
  integrationStatus: 'pendiente',
  viewData: null,
};

const render = () => {
  const currentView = viewRegistry[state.activeView];
  app.innerHTML = '';

  const shell = createShell({
    activeView: state.activeView,
    apiBaseUrl: appConfig.apiBaseUrl,
    integrationStatus: state.integrationStatus,
    onNavigate: async (viewId) => {
      state.activeView = viewId;
      state.integrationStatus = 'cargando';
      render();
      await loadViewData();
    },
  });

  shell.content.append(
    currentView.render({
      apiBaseUrl: appConfig.apiBaseUrl,
      integrationStatus: state.integrationStatus,
      data: state.viewData,
    }),
  );

  app.append(shell.element);
};

const loadViewData = async () => {
  try {
    state.viewData = await viewRegistry[state.activeView].load();
    state.integrationStatus = 'conectado';
  } catch (error) {
    state.viewData = null;
    state.integrationStatus = 'sin conexión';
  }

  render();
};

loadViewData();
