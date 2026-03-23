import './styles/app.css';
import { appConfig, formatApiBaseLabel } from './config/app.config.js';
import { createShell } from './components/shell.js';
import { clientService } from './services/client.service.js';
import { flotaSolicitudService } from './services/flota-solicitud.service.js';
import { expenseService } from './services/expense.service.js';
import { healthService } from './services/health.service.js';
import { blobToDataUrl, generateOtPdfBlob } from './services/pdf.service.js';
import { otService } from './services/ot.service.js';
import { vehicleService } from './services/vehicle.service.js';
import { dashboardView } from './views/dashboard.js';
import { climaView } from './views/clima.js';
import { flotaView } from './views/flota.js';
import { adminView } from './views/admin.js';
import { planificacionService } from './services/planificacion.service.js';
import { planificacionView } from './views/planificacion.js';
import { asistenteIaView } from './views/asistente-ia.js';
import {
  formatAllCloseBlockersMessage,
  otCanClose,
} from './utils/ot-evidence.js';

const app = document.querySelector('#app');
if (!app) {
  throw new Error('No se encontró #app en el DOM.');
}

/** Carga unificada OT + planificación + flota + salud (Inicio y Asistente IA). */
const loadFullOperationalData = async () => {
  const [health, ots, clients, vehicles, expenses, cr, tr, mr, sol] = await Promise.all([
    healthService.getStatus(),
    otService.getAll(),
    clientService.getAll(),
    vehicleService.getAll(),
    expenseService.getAll(),
    planificacionService.getClientes(),
    planificacionService.getTiendas({}),
    planificacionService.getMantenciones({}),
    flotaSolicitudService.getAll({}),
  ]);

  return {
    health,
    ots,
    clients,
    vehicles,
    expenses,
    planClientes: cr.data ?? [],
    planTiendas: tr.data ?? [],
    planMantenciones: mr.data ?? [],
    flotaSolicitudes: sol.data ?? [],
  };
};

const viewRegistry = {
  dashboard: {
    render: dashboardView,
    load: loadFullOperationalData,
  },

  asistente: {
    render: asistenteIaView,
    load: loadFullOperationalData,
  },

  clima: {
    render: climaView,
    load: () => otService.getAll(),
  },

  planificacion: {
    render: planificacionView,
    load: async () => {
      const [cr, tr, mr] = await Promise.all([
        planificacionService.getClientes(),
        planificacionService.getTiendas({}),
        planificacionService.getMantenciones({}),
      ]);
      return {
        planClientes: cr.data ?? [],
        planTiendas: tr.data ?? [],
        planMantenciones: mr.data ?? [],
      };
    },
  },

  flota: {
    render: flotaView,
    load: async () => {
      const [vehicles, expenses, sol] = await Promise.all([
        vehicleService.getAll(),
        expenseService.getAll(),
        flotaSolicitudService.getAll({}),
      ]);

      return { vehicles, expenses, flotaSolicitudes: sol.data ?? [] };
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

const openPdfBlobInNewTab = (blob) => {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.append(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 180000);
};

const state = {
  activeView: 'dashboard',
  integrationStatus: 'pendiente',
  viewData: null,
  selectedOTId: null,
  selectedFlotaId: null,
  otFeedback: null,
  flotaFeedback: null,
  adminFeedback: null,
  lastSuccessfulFetchAt: null,
  isSubmittingOT: false,
  isUpdatingOTStatus: false,
  isClosingOT: false,
  isUploadingEvidence: false,
  isGeneratingPdf: false,
  isSavingEquipos: false,
  isSavingVisitText: false,
  isSavingOtEconomics: false,
  /** Resultado económico persistido en servidor (válido) para la OT seleccionada en Clima */
  otEconomicsSaved: false,
};

const roundOtMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const otHasValidSavedEconomics = (ot) =>
  Boolean(ot && roundOtMoney(ot.montoCobrado) > 0 && roundOtMoney(ot.costoTotal) > 0);

const recomputeOtEconomicsSaved = () => {
  if (state.activeView !== 'clima') return;
  const ots = state.viewData?.data || [];
  const ot = ots.find((item) => item.id === state.selectedOTId);
  state.otEconomicsSaved = otHasValidSavedEconomics(ot);
};

const syncSelectedOT = () => {
  if (state.activeView !== 'clima') return;

  const ots = state.viewData?.data || [];
  if (!ots.length) {
    state.selectedOTId = null;
    return;
  }

  const exists = ots.some((item) => item.id === state.selectedOTId);
  if (!exists) {
    state.selectedOTId = ots[0]?.id ?? null;
  }
};

const syncSelectedFlota = () => {
  if (state.activeView !== 'flota') return;
  const list = state.viewData?.flotaSolicitudes || [];
  if (!list.length) {
    state.selectedFlotaId = null;
    return;
  }
  const exists = list.some((s) => s.id === state.selectedFlotaId);
  if (!exists) {
    state.selectedFlotaId = list[0]?.id ?? null;
  }
};

const createActions = () => ({
  selectOT: (id) => {
    state.selectedOTId = id;
    recomputeOtEconomicsSaved();
    render();
  },

  invalidateOtEconomicsSaved: () => {
    state.otEconomicsSaved = false;
    render();
  },

  showFeedback: (fb) => {
    state.otFeedback = fb;
    render();
  },

  setFlotaFeedback: (fb) => {
    state.flotaFeedback = fb;
    render();
  },

  selectFlota: (id) => {
    state.selectedFlotaId = id;
    render();
  },

  setAdminFeedback: (fb) => {
    state.adminFeedback = fb;
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
        message: 'OT creada. Seleccionála en el listado para cargar equipos, evidencias y cierre.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudo crear la orden de trabajo. Revisá los datos o la conexión.',
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
        message: `Estado actualizado a «${status}» (guardado en servidor).`,
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message:
          error.message ||
          'No se pudo cambiar el estado. Revisá fotos por equipo, checklist, resumen y recomendaciones si intentás cerrar la OT.',
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
        message: 'Evidencias guardadas en la OT.',
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

  saveOtEconomics: async (id, payload) => {
    state.isSavingOtEconomics = true;
    state.otFeedback = null;
    render();
    try {
      await otService.patchEconomics(id, payload);
      state.otFeedback = {
        type: 'success',
        message:
          'Costos e ingreso guardados en el servidor (CLP). La utilidad y el costo total se recalcularon en backend; la vista se actualizó.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudieron guardar los datos económicos.',
      };
      render();
    } finally {
      state.isSavingOtEconomics = false;
      render();
    }
  },

  saveVisitText: async (id, payload) => {
    state.isSavingVisitText = true;
    state.otFeedback = null;
    render();
    try {
      await otService.patchVisit(id, payload);
      state.otFeedback = {
        type: 'success',
        message: 'Textos de visita guardados en el servidor.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudieron guardar los textos de la visita.',
      };
      render();
    } finally {
      state.isSavingVisitText = false;
      render();
    }
  },

  saveEquipos: async (id, equiposPayload) => {
    state.isSavingEquipos = true;
    state.otFeedback = null;
    render();
    try {
      await otService.patchEquipos(id, { equipos: equiposPayload });
      state.otFeedback = {
        type: 'success',
        message: 'Equipos y evidencias guardados. Podés seguir editando o generar PDF de prueba.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudieron guardar equipos y fotos. Reintentá o revisá la conexión.',
      };
      render();
    } finally {
      state.isSavingEquipos = false;
      render();
    }
  },

  generatePdfFromOt: async (ot) => {
    if (state.isGeneratingPdf) return;
    const id = ot?.id;
    state.isGeneratingPdf = true;
    state.otFeedback = null;
    render();
    try {
      if (state.activeView === 'clima' && id) {
        await loadViewData();
      }
      const snap =
        id && state.viewData?.data
          ? state.viewData.data.find((o) => o.id === id) || ot
          : ot;
      const { blob, fileName } = await generateOtPdfBlob(snap);
      openPdfBlobInNewTab(blob);
      state.otFeedback = {
        type: 'success',
        message: `PDF abierto (${fileName}). Refleja la última carga del servidor; cambios sin guardar no entran.`,
      };
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudo generar el PDF.',
      };
    } finally {
      state.isGeneratingPdf = false;
      render();
    }
  },

  // Cierre OT: alinear con buildOtOperationalBrief (Clima) para futura capa IA operativa.
  closeAndGenerateReport: async (ot, economicsPayload = null) => {
    const id = ot?.id;
    if (!id) return;
    if (state.isClosingOT) return;

    let fresh = state.viewData?.data?.find((o) => o.id === id) || ot;

    if (!state.otEconomicsSaved && economicsPayload != null && fresh.estado !== 'terminado') {
      state.isSavingOtEconomics = true;
      state.otFeedback = null;
      render();
      try {
        await otService.patchEconomics(id, economicsPayload);
        await loadViewData();
        fresh = state.viewData?.data?.find((o) => o.id === id) || fresh;
      } catch (error) {
        state.otFeedback = {
          type: 'error',
          message: error.message || 'No se pudieron guardar los datos económicos.',
        };
        state.isSavingOtEconomics = false;
        render();
        return;
      } finally {
        state.isSavingOtEconomics = false;
      }
    }

    if (!state.otEconomicsSaved) {
      state.otFeedback = {
        type: 'error',
        message:
          economicsPayload != null
            ? 'No quedó un resultado económico válido en el servidor (monto cobrado y costo total deben ser mayores que cero). Revisá los importes y guardá de nuevo.'
            : 'Debes guardar el resultado económico antes de cerrar la OT.',
      };
      render();
      return;
    }

    fresh = state.viewData?.data?.find((o) => o.id === id) || fresh;
    if (!fresh) {
      state.otFeedback = {
        type: 'error',
        message: 'No se encontró la orden de trabajo actualizada.',
      };
      render();
      return;
    }

    if (roundOtMoney(fresh.montoCobrado) <= 0 || roundOtMoney(fresh.costoTotal) <= 0) {
      state.otFeedback = {
        type: 'error',
        message:
          'El monto cobrado y el costo total guardados en el servidor deben ser mayores que cero antes de cerrar.',
      };
      render();
      return;
    }

    if (!otCanClose(fresh)) {
      state.otFeedback = {
        type: 'error',
        message: formatAllCloseBlockersMessage(fresh),
      };
      render();
      return;
    }

    state.isClosingOT = true;
    state.otFeedback = null;
    render();

    try {
      await otService.updateStatus(id, { estado: 'terminado' });
      await loadViewData();
      fresh = state.viewData?.data?.find((o) => o.id === id) || {
        ...fresh,
        estado: 'terminado',
      };
      const otClosed = { ...fresh, estado: 'terminado' };
      const { blob, fileName } = await generateOtPdfBlob(otClosed);
      openPdfBlobInNewTab(blob);
      const pdfUrl = await blobToDataUrl(blob);
      await otService.patchReport(id, { pdfName: fileName, pdfUrl });
      state.otFeedback = {
        type: 'success',
        message:
          'OT cerrada (terminado). Informe PDF guardado en la orden; revisá la pestaña abierta.',
      };
      await loadViewData();
    } catch (error) {
      state.otFeedback = {
        type: 'error',
        message: error.message || 'No se pudo cerrar la visita con informe. Revisá evidencias y conexión.',
      };
      render();
    } finally {
      state.isClosingOT = false;
      render();
    }
  },
});

async function navigateToView(viewId) {
  if (!viewRegistry[viewId]) return;
  state.activeView = viewId;
  state.integrationStatus = 'cargando';
  if (viewId !== 'clima') {
    state.otFeedback = null;
  }
  if (viewId !== 'flota') {
    state.flotaFeedback = null;
  }
  if (viewId !== 'admin') {
    state.adminFeedback = null;
  }
  render();
  await loadViewData();
}

const render = () => {
  const currentView = viewRegistry[state.activeView];
  app.innerHTML = '';

  const shell = createShell({
    activeView: state.activeView,
    apiBaseLabel: formatApiBaseLabel(),
    integrationStatus: state.integrationStatus,
    onNavigate: (viewId) => navigateToView(viewId),
  });

  shell.content.className = `content content--view-${state.activeView}`;

  shell.content.append(
    currentView.render({
      apiBaseLabel: formatApiBaseLabel(),
      integrationStatus: state.integrationStatus,
      lastDataRefreshAt: state.lastSuccessfulFetchAt,
      data: state.viewData,
      actions: createActions(),
      feedback: state.otFeedback,
      flotaFeedback: state.flotaFeedback,
      adminFeedback: state.adminFeedback,
      isSubmitting: state.isSubmittingOT,
      isUpdatingStatus: state.isUpdatingOTStatus,
      isClosingOT: state.isClosingOT,
      isUploadingEvidence: state.isUploadingEvidence,
      isGeneratingPdf: state.isGeneratingPdf,
      isSavingEquipos: state.isSavingEquipos,
      isSavingVisitText: state.isSavingVisitText,
      isSavingOtEconomics: state.isSavingOtEconomics,
      otEconomicsSaved: state.otEconomicsSaved,
      selectedOTId: state.selectedOTId,
      selectedFlotaId: state.selectedFlotaId,
      reloadApp: loadViewData,
      navigateToView,
    })
  );

  app.append(shell.element);
};

/** Recarga datos de la vista activa. Devuelve true si el servidor respondió bien. */
const loadViewData = async () => {
  try {
    state.viewData = await viewRegistry[state.activeView].load();
    state.integrationStatus = 'conectado';
    state.lastSuccessfulFetchAt = new Date().toISOString();
    syncSelectedOT();
    syncSelectedFlota();
    recomputeOtEconomicsSaved();
    render();
    return true;
  } catch (error) {
    state.viewData = null;
    state.integrationStatus = 'sin conexión';
    render();
    return false;
  }
};

loadViewData();