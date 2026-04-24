import { appConfig } from './config/app.config.js';
import { createShell } from './components/shell.js';
import { approvalService } from './services/approval.service.js';
import { climaService } from './services/clima.service.js';
import { flotaService } from './services/flota.service.js';
import { gestionService } from './services/gestion.service.js';
import { healthService } from './services/health.service.js';
import { logService } from './services/log.service.js';
import { matrizService } from './services/matriz.service.js';
import { messageService } from './services/message.service.js';
import { homeView } from './views/home.js';
import { inboxView } from './views/inbox.js';
import { approvalLynView } from './views/approval-lyn.js';
import { managerView } from './views/manager.js';

const app = document.querySelector('#app');

const viewRegistry = {
  home: {
    render: homeView,
    load: async () => {
      const [health, messages, approvals] = await Promise.all([healthService.getStatus(), messageService.getAll(), approvalService.getAll()]);
      return { health, messages, approvals };
    },
  },
  inbox: {
    render: inboxView,
    load: async () => {
      const [messages, gestiones] = await Promise.all([messageService.getAll(), gestionService.getAll()]);
      return { messages, gestiones };
    },
  },
  approval: {
    render: approvalLynView,
    load: async () => {
      const [messages, gestiones] = await Promise.all([messageService.getAll(), gestionService.getAll()]);
      return { messages, gestiones };
    },
  },
  manager: {
    render: managerView,
    load: async () => {
      const [matriz, approvals, logs] = await Promise.all([matrizService.getAll(), approvalService.getAll(), logService.getAll()]);
      return { matriz, approvals, logs };
    },
  },
};

const state = { activeView: 'home', integrationStatus: 'pendiente', viewData: null, feedback: null };

const refresh = async (message) => {
  state.feedback = { type: 'success', message };
  await loadViewData();
};

const fail = (error) => {
  state.feedback = { type: 'error', message: error.message || 'Error de operación' };
  render();
};

const actions = {
  async reviewMessage(messageId) {
    try {
      await messageService.reviewByGery(messageId, { actor: 'Gery', clasificacion: 'flota' });
      await refresh('Mensaje revisado y clasificado por Gery.');
    } catch (error) {
      fail(error);
    }
  },
  async convertToGestion(messageId) {
    try {
      const all = await messageService.getAll();
      const message = (all.data || []).find((m) => m.id === messageId);
      if (!message) throw new Error('Mensaje no encontrado para convertir');
      await gestionService.create({
        actor: 'Gery',
        fecha: new Date().toISOString().slice(0, 10),
        cliente: message.nombre,
        patente: 'PENDIENTE',
        servicio: message.mensaje,
        tipo: message.clasificacion === 'clima' ? 'mantencion' : 'RT',
        tecnico: 'Por asignar',
        origenMensajeId: message.id,
      });
      await refresh('Gestión creada desde inbox.');
    } catch (error) {
      fail(error);
    }
  },
  async approveMessage(messageId) {
    try {
      await messageService.approveByLyn(messageId, { actor: 'Lyn' });
      await refresh('Mensaje aprobado por Lyn.');
    } catch (error) {
      fail(error);
    }
  },
  async createApprovedOT(payload) {
    try {
      const gestiones = await gestionService.getAll();
      const g = (gestiones.data || []).find((row) => row.id === payload.gestionId);
      if (!g) throw new Error('Gestión no encontrada');

      if (payload.unidad === 'flota') {
        await flotaService.createOT({
          // CLIENT
          cliente: payload.cliente,
          direccion: 'Por definir en gestión',
          contacto: 'Por definir',
          correo: 'pendiente@cliente.cl',
          // VEHICLE
          patente: g.patente,
          marca: 'Por definir',
          modelo: 'Por definir',
          año: 0,
          kilometraje: 0,
          // SERVICE
          tipo_servicio: payload.tipoServicio,
          descripcion: g.servicio,
          fecha: payload.fecha,
          hora_inicio: payload.horaInicio,
          hora_termino: payload.horaTermino,
          duracion: `${payload.horaInicio}-${payload.horaTermino}`,
          tecnico: payload.tecnico,
          // COSTS (auto total)
          items_servicio: [{ descripcion: payload.tipoServicio, cantidad: 1, precio_unitario: payload.costo }],
          items_insumos: [],
          // CONTROL
          estado: 'en_proceso',
          creadoDesdeMensajeId: g.origenMensajeId,
          creadoDesdeGestionId: g.id,
          // EVIDENCE
          fotos: [],
          // approval
          aprobadaPor: 'Lyn',
          actor: 'Lyn',
        });
      } else {
        await climaService.createOT({
          cliente: payload.cliente,
          tienda: g.cliente,
          fecha: payload.fecha,
          horaInicio: payload.horaInicio,
          horaTermino: payload.horaTermino,
          duracion: `${payload.horaInicio}-${payload.horaTermino}`,
          tecnico: payload.tecnico,
          tipoServicio: payload.tipoServicio,
          descripcion: g.servicio,
          costoTotal: payload.costo,
          estado: 'en_proceso',
          creadoDesde: 'gestion',
          aprobadaPor: 'Lyn',
          actor: 'Lyn',
          origenMensajeId: g.origenMensajeId,
        });
      }

      await refresh('OT creada con aprobación obligatoria de Lyn.');
    } catch (error) {
      fail(error);
    }
  },
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

  shell.content.append(currentView.render({ data: state.viewData, actions, feedback: state.feedback }));
  app.append(shell.element);
};

const loadViewData = async () => {
  try {
    state.viewData = await viewRegistry[state.activeView].load();
    state.integrationStatus = 'conectado';
  } catch {
    state.viewData = null;
    state.integrationStatus = 'sin conexión';
  }
  render();
};

loadViewData();
