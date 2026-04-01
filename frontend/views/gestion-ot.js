import { getSessionBackendRole } from '../config/session-bridge.js';
import { filtrarOtsPorRolBackend } from '../domain/hnf-operativa-reglas.js';
import {
  OT_BOARD_FILTER_ESTADO,
  OT_BOARD_STATUS_API_OPTIONS,
  labelOtBoardEstado,
  otBoardEstadoBucket,
} from '../domain/hnf-ot-board.js';
import { HNF_OT_TECNICOS_PRESETS, labelPrioridadOperativa } from '../constants/hnf-ot-operation.js';

const isClosedBucket = (ot) => otBoardEstadoBucket(ot) === 'cerrada';

const openDialog = (dialog) => {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
};

const closeDialog = (dialog) => {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
};

/**
 * Tablero operativo: lista densa de OT con filtros y acciones por fila.
 */
export const gestionOtView = ({
  data,
  actions,
  feedback,
  integrationStatus,
  reloadApp,
  navigateToView,
  isUpdatingStatus = false,
  isPatchingOtOperational = false,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'hnf-ot-board hnf-op-view';

  const header = document.createElement('div');
  header.className = 'module-header hnf-ot-board__header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Gestión de OT';
  const lead = document.createElement('p');
  lead.className = 'muted small hnf-ot-board__lead';
  lead.textContent =
    'Listado operativo. Filtrá y actuá por fila; el detalle y edición completos están en Clima.';
  header.append(h2, lead);

  if (feedback?.message) {
    const notice = document.createElement('div');
    notice.className = `form-feedback form-feedback--${feedback.type} workspace-notice`;
    notice.setAttribute('role', 'status');
    notice.textContent = feedback.message;
    header.append(notice);
  }

  const br = getSessionBackendRole() || 'admin';
  let ots = Array.isArray(data?.data) ? [...data.data] : [];
  ots = filtrarOtsPorRolBackend(ots, br);
  ots.sort((a, b) => String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true }));

  const toolbar = document.createElement('div');
  toolbar.className = 'hnf-ot-board__filters';

  const fEst = document.createElement('select');
  fEst.className = 'hnf-ot-board__filter';
  fEst.setAttribute('aria-label', 'Filtrar por estado');
  OT_BOARD_FILTER_ESTADO.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    fEst.append(opt);
  });

  const fCliente = document.createElement('input');
  fCliente.type = 'search';
  fCliente.className = 'hnf-ot-board__filter';
  fCliente.placeholder = 'Cliente (contiene)';
  fCliente.setAttribute('aria-label', 'Filtrar por cliente');

  const fDesde = document.createElement('input');
  fDesde.type = 'date';
  fDesde.className = 'hnf-ot-board__filter';
  fDesde.setAttribute('aria-label', 'Fecha desde');

  const fHasta = document.createElement('input');
  fHasta.type = 'date';
  fHasta.className = 'hnf-ot-board__filter';
  fHasta.setAttribute('aria-label', 'Fecha hasta');

  const btnRefresh = document.createElement('button');
  btnRefresh.type = 'button';
  btnRefresh.className = 'secondary-button';
  btnRefresh.textContent = 'Actualizar';
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.disabled = true;
    await reloadApp?.();
    btnRefresh.disabled = false;
    renderTable();
  });

  toolbar.append(fEst, fCliente, fDesde, fHasta, btnRefresh);

  const scroll = document.createElement('div');
  scroll.className = 'hnf-ot-board__scroll';

  const table = document.createElement('table');
  table.className = 'hnf-ot-board__table';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th scope="col">ID OT</th>
      <th scope="col">Cliente</th>
      <th scope="col">Dirección</th>
      <th scope="col">Fecha</th>
      <th scope="col">Estado</th>
      <th scope="col">Técnico</th>
      <th scope="col">Prioridad</th>
      <th scope="col">Acciones</th>
    </tr>
  `;
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);
  scroll.append(table);

  /** @type {object | null} */
  let dialogOt = null;
  const dlgEstado = document.createElement('dialog');
  dlgEstado.className = 'hnf-ot-board__dialog';
  const dlgEstForm = document.createElement('form');
  dlgEstForm.method = 'dialog';
  dlgEstForm.innerHTML = '<p class="hnf-ot-board__dialog-title">Cambiar estado</p>';
  const selEst = document.createElement('select');
  selEst.className = 'hnf-ot-board__dialog-select';
  OT_BOARD_STATUS_API_OPTIONS.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    selEst.append(opt);
  });
  const dlgEstActions = document.createElement('div');
  dlgEstActions.className = 'hnf-ot-board__dialog-actions';
  const btnEstCancel = document.createElement('button');
  btnEstCancel.type = 'button';
  btnEstCancel.className = 'secondary-button';
  btnEstCancel.textContent = 'Cancelar';
  const btnEstOk = document.createElement('button');
  btnEstOk.type = 'submit';
  btnEstOk.className = 'primary-button';
  btnEstOk.textContent = isUpdatingStatus ? 'Guardando…' : 'Guardar';
  btnEstOk.disabled = Boolean(isUpdatingStatus);
  dlgEstActions.append(btnEstCancel, btnEstOk);
  dlgEstForm.append(selEst, dlgEstActions);
  dlgEstado.append(dlgEstForm);
  btnEstCancel.addEventListener('click', () => closeDialog(dlgEstado));
  dlgEstForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!dialogOt?.id) return;
    await actions?.updateOTStatus?.(dialogOt.id, selEst.value);
    closeDialog(dlgEstado);
    await reloadApp?.();
    renderTable();
  });

  const dlgTech = document.createElement('dialog');
  dlgTech.className = 'hnf-ot-board__dialog';
  const dlgTechForm = document.createElement('form');
  dlgTechForm.method = 'dialog';
  const techTitle = document.createElement('p');
  techTitle.className = 'hnf-ot-board__dialog-title';
  techTitle.textContent = 'Asignar técnico';
  const selTech = document.createElement('select');
  selTech.className = 'hnf-ot-board__dialog-select';
  const techOther = document.createElement('input');
  techOther.type = 'text';
  techOther.className = 'hnf-ot-board__dialog-input';
  techOther.placeholder = 'Otro nombre';
  techOther.hidden = true;
  HNF_OT_TECNICOS_PRESETS.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    selTech.append(opt);
  });
  const otroOpt = document.createElement('option');
  otroOpt.value = '__otro__';
  otroOpt.textContent = 'Otro';
  selTech.append(otroOpt);
  selTech.addEventListener('change', () => {
    techOther.hidden = selTech.value !== '__otro__';
  });
  const dlgTechActions = document.createElement('div');
  dlgTechActions.className = 'hnf-ot-board__dialog-actions';
  const btnTechCancel = document.createElement('button');
  btnTechCancel.type = 'button';
  btnTechCancel.className = 'secondary-button';
  btnTechCancel.textContent = 'Cancelar';
  const btnTechOk = document.createElement('button');
  btnTechOk.type = 'submit';
  btnTechOk.className = 'primary-button';
  btnTechOk.textContent = isPatchingOtOperational ? 'Guardando…' : 'Guardar';
  btnTechOk.disabled = Boolean(isPatchingOtOperational);
  dlgTechActions.append(btnTechCancel, btnTechOk);
  dlgTechForm.append(techTitle, selTech, techOther, dlgTechActions);
  dlgTech.append(dlgTechForm);
  btnTechCancel.addEventListener('click', () => closeDialog(dlgTech));
  dlgTechForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!dialogOt?.id) return;
    let t = selTech.value;
    if (t === '__otro__') t = techOther.value.trim() || 'Por asignar';
    await actions?.patchOtOperational?.(dialogOt.id, {
      operationMode: dialogOt.operationMode || 'manual',
      tecnicoAsignado: t,
      origenPedido: dialogOt.origenPedido || dialogOt.origenSolicitud || 'cliente_directo',
    });
    closeDialog(dlgTech);
    await reloadApp?.();
    renderTable();
  });

  const goClima = (otId) => {
    if (typeof navigateToView !== 'function') return;
    navigateToView('clima', { otId });
  };

  function applyFilters(list) {
    const est = fEst.value;
    const q = fCliente.value.trim().toLowerCase();
    const d0 = fDesde.value;
    const d1 = fHasta.value;
    return list.filter((ot) => {
      if (est && otBoardEstadoBucket(ot) !== est) return false;
      if (q && !String(ot.cliente || '').toLowerCase().includes(q)) return false;
      const fd = String(ot.fecha || '').slice(0, 10);
      if (d0 && fd && fd < d0) return false;
      if (d1 && fd && fd > d1) return false;
      return true;
    });
  }

  function renderTable() {
    tbody.replaceChildren();
    const rows = applyFilters(ots);
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'hnf-ot-board__empty muted';
      td.textContent =
        integrationStatus === 'sin conexión'
          ? 'Sin conexión: no hay datos de OT.'
          : 'Ninguna OT coincide con los filtros.';
      tr.append(td);
      tbody.append(tr);
      return;
    }
    for (const ot of rows) {
      const tr = document.createElement('tr');
      tr.dataset.otId = String(ot.id || '');
      const td = (text, cls) => {
        const c = document.createElement('td');
        if (cls) c.className = cls;
        c.textContent = text;
        return c;
      };
      tr.append(
        td(String(ot.id || '—'), 'hnf-ot-board__mono'),
        td(String(ot.cliente || '—')),
        td(String(ot.direccion || '—')),
        td(String(ot.fecha || '—')),
        td(labelOtBoardEstado(ot)),
        td(String(ot.tecnicoAsignado || '—')),
        td(labelPrioridadOperativa(ot.prioridadOperativa))
      );
      const tdAct = document.createElement('td');
      tdAct.className = 'hnf-ot-board__actions';
      const sel = document.createElement('select');
      sel.className = 'hnf-ot-board__action-select';
      sel.setAttribute('aria-label', `Acciones OT ${ot.id}`);
      [
        { value: '', label: 'Acción…' },
        { value: 'ver', label: 'Ver detalle' },
        { value: 'editar', label: 'Editar OT' },
        { value: 'tecnico', label: 'Asignar técnico' },
        { value: 'estado', label: 'Cambiar estado' },
        { value: 'cerrar', label: 'Cerrar OT (en Clima)' },
      ].forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.append(opt);
      });
      const closed = isClosedBucket(ot);
      if (closed) {
        Array.from(sel.querySelectorAll('option'))
          .filter((o) => ['tecnico', 'estado', 'cerrar'].includes(o.value))
          .forEach((o) => o.setAttribute('disabled', 'true'));
      }
      sel.addEventListener('change', () => {
        const v = sel.value;
        sel.value = '';
        if (!v) return;
        if (v === 'ver' || v === 'editar') {
          goClima(ot.id);
          return;
        }
        if (v === 'tecnico') {
          dialogOt = ot;
          selTech.value = HNF_OT_TECNICOS_PRESETS.some((p) => p.value === ot.tecnicoAsignado)
            ? ot.tecnicoAsignado
            : '__otro__';
          techOther.value =
            selTech.value === '__otro__' ? String(ot.tecnicoAsignado || '') : '';
          techOther.hidden = selTech.value !== '__otro__';
          openDialog(dlgTech);
          return;
        }
        if (v === 'estado') {
          dialogOt = ot;
          const cur = String(ot.estado || '').toLowerCase().replace(/\s+/g, '_');
          const apiVal =
            cur === 'en proceso'
              ? 'en_proceso'
              : OT_BOARD_STATUS_API_OPTIONS.some((o) => o.value === cur)
                ? cur
                : 'nueva';
          selEst.value = OT_BOARD_STATUS_API_OPTIONS.some((o) => o.value === apiVal) ? apiVal : 'nueva';
          openDialog(dlgEstado);
          return;
        }
        if (v === 'cerrar') {
          goClima(ot.id);
          actions?.showFeedback?.({
            type: 'neutral',
            message: 'En Clima completá economía y cierre con informe PDF.',
          });
        }
      });
      tdAct.append(sel);
      tr.append(tdAct);
      tbody.append(tr);
    }
  }

  root.append(header, toolbar, scroll, dlgEstado, dlgTech);

  if (integrationStatus === 'sin conexión') {
    const off = document.createElement('div');
    off.className = 'integration-banner integration-banner--offline';
    off.textContent = 'Sin conexión al servidor.';
    root.append(off);
  }

  fEst.addEventListener('change', renderTable);
  fCliente.addEventListener('input', renderTable);
  fDesde.addEventListener('change', renderTable);
  fHasta.addEventListener('change', renderTable);

  renderTable();

  return root;
};
