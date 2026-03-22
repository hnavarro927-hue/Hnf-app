import { appConfig } from './config/app.config.js';
import { createShell } from './components/shell.js';
import { clientService } from './services/client.service.js';
import { expenseService } from './services/expense.service.js';
import { healthService } from './services/health.service.js';
import { blobToDataUrl, generateOtPdfBlob } from './services/pdf.service.js';
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

const OT_CLOSE_EVIDENCE_MESSAGE =
  'Debes cargar evidencias (antes, durante y después) antes de cerrar la OT';

const state = {
  activeView: 'dashboard',
  integrationStatus: 'pendiente',
  viewData: null,
  selectedOTId: null,
  otFeedback: null,
  isSubmittingOT: false,
  isUpdatingOTStatus: false,
  isClosingOT: false,
  isUploadingEvidence: false,
};

const syncSelectedOT = () => {
  if (state.activeView !== 'clima') return;

  const ots = state.viewData?.data || [];
  if (!ots.length) {
    state.selectedOTId = null;
    return;
  }

  const exists = ots.some(item => item.id === state.selectedOTId);
  if (!exists) {
    state.selectedOTId = ots[ots.length - 1].id;
  }
};

const createActions = () => ({
  selectOT: (id) => {
    state.selectedOTId = id;
    render();
  },

  showFeedback: (fb) => {
    state.otFeedback = fb;
    render();
  },

  createOT: async (payload) => {
    state.isSubmittingOT = true;
    state.otFeedback = null;
    render();

    try {
      const response = await otService.create(payload);
      state.selectedOTId = response.data.id;
      state.otFeedback = {
        type: 'success',
        message: 'OT creada correctamente y lista para revisión en pantalla o futuro PDF.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No fue posible crear la OT.',
      };
      render();
    } finally {
      state.isSubmittingOT = false;
      render();
    }
  },

  updateOTStatus: async (id, status) => {
    state.isUpdatingOTStatus = true;
    state.otFeedback = null;
    render();

    try {
      await otService.updateStatus(id, { estado: status });
      state.otFeedback = {
        type: 'success',
        message: `Estado de la OT actualizado a ${status}.`,
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No fue posible actualizar el estado de la OT.',
      };
      render();
    } finally {
      state.isUpdatingOTStatus = false;
      render();
    }
  },

  addEvidences: async (id, payload) => {
    state.isUploadingEvidence = true;
    state.otFeedback = null;
    render();

    try {
      await otService.patchEvidences(id, payload);
      state.otFeedback = {
        type: 'success',
        message: 'Evidencias agregadas correctamente.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No fue posible agregar evidencias.',
      };
      render();
    } finally {
      state.isUploadingEvidence = false;
      render();
    }
  },

  closeAndGenerateReport: async (ot) => {
    const hasEvidence =
      (ot.fotografiasAntes?.length || 0) >= 1 &&
      (ot.fotografiasDurante?.length || 0) >= 1 &&
      (ot.fotografiasDespues?.length || 0) >= 1;

    if (!hasEvidence) {
      state.otFeedback = { type: 'error', message: OT_CLOSE_EVIDENCE_MESSAGE };
      render();
      return;
    }

    state.isClosingOT = true;
    state.otFeedback = null;
    render();

    try {
      await otService.updateStatus(ot.id, { estado: 'terminado' });
      const otClosed = { ...ot, estado: 'terminado' };
      const { blob, fileName } = await generateOtPdfBlob(otClosed);
      const pdfUrl = await blobToDataUrl(blob);
      await otService.patchReport(ot.id, { pdfName: fileName, pdfUrl });
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      state.otFeedback = {
        type: 'success',
        message: 'OT cerrada: estado terminado, informe PDF generado y guardado de forma persistente.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No fue posible completar el cierre con informe.',
      };
      render();
    } finally {
      state.isClosingOT = false;
      render();
    }
  },
});

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

      if (viewId !== 'clima') {
        state.otFeedback = null;
      }

      render();
      await loadViewData();
    },
  });

  shell.content.append(
    currentView.render({
      apiBaseUrl: appConfig.apiBaseUrl,
      integrationStatus: state.integrationStatus,
      data: state.viewData,
      actions: createActions(),
      feedback: state.otFeedback,
      isSubmitting: state.isSubmittingOT,
      isUpdatingStatus: state.isUpdatingOTStatus,
      isClosingOT: state.isClosingOT,
      isUploadingEvidence: state.isUploadingEvidence,
      selectedOTId: state.selectedOTId,
    })
  );

  app.append(shell.element);
};

const loadViewData = async () => {
  try {
    state.viewData = await viewRegistry[state.activeView].load();
    state.integrationStatus = 'conectado';
    syncSelectedOT();
  } catch (error) {
    state.viewData = null;
    state.integrationStatus = 'sin conexión';
  }

  render();
};

loadViewData();