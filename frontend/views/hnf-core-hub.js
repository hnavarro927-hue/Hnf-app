import { resolveOperatorRole } from '../domain/hnf-operator-role.js';
import {
  HNF_CORE_CHECKLIST_KEYS,
  HNF_CORE_ESTADO_COLUMNS,
  computeHnfCoreSolicitudStats,
  demoraAlertaSolicitud,
  filterSolicitudesForRole,
  labelEstadoSolicitud,
  nextEstadoSugerido,
  solicitudProgressPct,
} from '../domain/hnf-core-hub.js';
import { hnfCoreSolicitudesService } from '../services/hnf-core-solicitudes.service.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Core HNF — solicitudes (Kanban + lista) + pestañas Finanzas / Equipo (datos operativos existentes).
 */
export const hnfCoreHubView = ({
  data,
  reloadApp,
  navigateToView,
} = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-core-hub';

  const role = resolveOperatorRole();
  let tab = 'solicitudes';
  let layout = 'kanban';
  let list = Array.isArray(data?.hnfCoreSolicitudes) ? [...data.hnfCoreSolicitudes] : [];
  let filtered = filterSolicitudesForRole(list, role);

  let stats = computeHnfCoreSolicitudStats(list);

  const header = document.createElement('header');
  header.className = 'hnf-core-hub__head';
  header.innerHTML = `<h1 class="hnf-core-hub__title">HNF CORE</h1>
    <p class="hnf-core-hub__sub muted">Solicitudes unificadas · ${stats.lineaNucleo}</p>`;

  const tabs = document.createElement('div');
  tabs.className = 'hnf-core-hub__tabs';

  const mkTab = (id, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-core-hub__tab';
    b.textContent = label;
    b.dataset.tab = id;
    b.addEventListener('click', () => {
      tab = id;
      syncTabs();
      renderBody();
    });
    return b;
  };

  tabs.append(
    mkTab('solicitudes', 'Solicitudes'),
    mkTab('finanzas', 'Finanzas'),
    mkTab('equipo', 'Equipo')
  );

  const syncTabs = () => {
    tabs.querySelectorAll('.hnf-core-hub__tab').forEach((btn) => {
      btn.classList.toggle('hnf-core-hub__tab--on', btn.dataset.tab === tab);
    });
  };
  syncTabs();

  const toolbar = document.createElement('div');
  toolbar.className = 'hnf-core-hub__toolbar';

  const body = document.createElement('div');
  body.className = 'hnf-core-hub__body';

  const feedback = document.createElement('p');
  feedback.className = 'form-feedback';
  feedback.hidden = true;

  const showFb = (msg, isErr = false) => {
    if (!msg) {
      feedback.hidden = true;
      return;
    }
    feedback.hidden = false;
    feedback.className = `form-feedback ${isErr ? 'form-feedback--error' : 'form-feedback--success'}`;
    feedback.textContent = msg;
  };

  const refresh = async () => {
    if (typeof reloadApp === 'function') await reloadApp();
  };

  const applyLocal = (nextList) => {
    list = nextList;
    filtered = filterSolicitudesForRole(list, role);
    stats = computeHnfCoreSolicitudStats(list);
    const sub = header.querySelector('.hnf-core-hub__sub');
    if (sub) sub.textContent = `Solicitudes unificadas · ${stats.lineaNucleo}`;
    renderBody();
  };

  const patchRemote = async (id, payload) => {
    const res = await hnfCoreSolicitudesService.patch(id, payload);
    const row = res?.data ?? res;
    if (!row?.id) throw new Error('Respuesta inválida');
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list[i] = row;
    else list.push(row);
    applyLocal([...list]);
  };

  const renderFinanzas = () => {
    const ots = data?.planOts ?? data?.ots?.data ?? [];
    const exp = Array.isArray(data?.expenses)
      ? data.expenses
      : Array.isArray(data?.expenses?.data)
        ? data.expenses.data
        : [];
    const arr = Array.isArray(ots) ? ots : [];
    const ex = Array.isArray(exp) ? exp : [];
    let ing = 0;
    let egr = 0;
    for (const o of arr) {
      ing += Number(o.montoCobrado || o.monto || 0) || 0;
      egr += Number(o.costoTotal || 0) || 0;
    }
    for (const e of ex) {
      egr += Math.abs(Number(e.monto || e.amount || 0) || 0);
    }
    const util = ing - egr;
    const wrap = document.createElement('div');
    wrap.className = 'hnf-core-fin tarjeta';
    wrap.innerHTML = `
      <h2 class="hnf-core-fin__h">Resumen financiero (operativo)</h2>
      <p class="muted small">Agregado desde OT y egresos cargados. IVA y cuentas por pagar: extensión pendiente con contabilidad.</p>
      <div class="hnf-core-fin__grid">
        <div class="hnf-core-fin__cell"><span class="hnf-core-fin__l">Ingresos (OT)</span><span class="hnf-core-fin__v">${esc(Math.round(ing).toLocaleString('es-CL'))}</span></div>
        <div class="hnf-core-fin__cell"><span class="hnf-core-fin__l">Egresos / costos</span><span class="hnf-core-fin__v">${esc(Math.round(egr).toLocaleString('es-CL'))}</span></div>
        <div class="hnf-core-fin__cell hnf-core-fin__cell--util"><span class="hnf-core-fin__l">Utilidad aprox.</span><span class="hnf-core-fin__v">${esc(Math.round(util).toLocaleString('es-CL'))}</span></div>
      </div>
      <p class="hnf-core-fin__alert muted small">Alertas IVA y CxP: conectar módulo contable o cargar categorías en egresos.</p>`;
    return wrap;
  };

  const renderEquipo = () => {
    const ots = data?.planOts ?? data?.ots?.data ?? [];
    const arr = Array.isArray(ots) ? ots : [];
    const byTec = {};
    for (const o of arr) {
      const t = String(o.tecnicoAsignado || 'Sin asignar').trim() || 'Sin asignar';
      if (!byTec[t]) byTec[t] = { n: 0, monto: 0 };
      byTec[t].n += 1;
      byTec[t].monto += Number(o.montoCobrado || o.monto || 0) || 0;
    }
    const wrap = document.createElement('div');
    wrap.className = 'hnf-core-eq tarjeta';
    const h = document.createElement('h2');
    h.className = 'hnf-core-eq__h';
    h.textContent = 'Equipo · carga por técnico';
    const ul = document.createElement('ul');
    ul.className = 'hnf-core-eq__list';
    const rows = Object.entries(byTec).sort((a, b) => b[1].n - a[1].n);
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Sin OT en el lote actual.';
      ul.append(li);
    } else {
      for (const [name, v] of rows) {
        const li = document.createElement('li');
        li.className = 'hnf-core-eq__row';
        li.innerHTML = `<strong>${esc(name)}</strong><span>${v.n} OT · $${esc(Math.round(v.monto).toLocaleString('es-CL'))}</span>`;
        ul.append(li);
      }
    }
    wrap.append(h, ul);
    return wrap;
  };

  const renderCard = (s) => {
    const card = document.createElement('article');
    card.className = 'hnf-core-card';
    const pct = solicitudProgressPct(s);
    const dem = demoraAlertaSolicitud(s);
    if (dem?.nivel === 'critico') card.classList.add('hnf-core-card--delay-crit');
    else if (dem?.nivel === 'alerta') card.classList.add('hnf-core-card--delay-warn');

    const top = document.createElement('div');
    top.className = 'hnf-core-card__top';
    top.innerHTML = `<span class="hnf-core-card__id">${esc(s.id)}</span>
      <span class="hnf-core-card__tipo">${esc(s.tipo)}</span>`;

    const cli = document.createElement('p');
    cli.className = 'hnf-core-card__cli';
    cli.textContent = s.cliente || '—';

    const resp = document.createElement('p');
    resp.className = 'hnf-core-card__resp';
    resp.textContent = s.responsable || '—';

    const bar = document.createElement('div');
    bar.className = 'hnf-core-card__bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.innerHTML = `<span class="hnf-core-card__bar-fill" style="width:${pct}%"></span>`;

    const chk = document.createElement('div');
    chk.className = 'hnf-core-card__chk';
    for (const k of HNF_CORE_CHECKLIST_KEYS) {
      const d = document.createElement('span');
      d.className = `hnf-core-card__dot ${s.checklist?.[k] ? 'hnf-core-card__dot--on' : ''}`;
      d.title = k;
      chk.append(d);
    }

    const actions = document.createElement('div');
    actions.className = 'hnf-core-card__actions';
    const next = nextEstadoSugerido(s);
    if (next) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button hnf-core-card__btn';
      b.textContent = `→ ${labelEstadoSolicitud(next)}`;
      b.addEventListener('click', async () => {
        try {
          await patchRemote(s.id, { estado: next });
          showFb(`Actualizado ${s.id}`);
        } catch (e) {
          showFb(e.message || 'Error', true);
        }
      });
      actions.append(b);
    }
    if (role === 'control' && s.estado === 'pendiente_aprobacion') {
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'primary-button hnf-core-card__btn';
      ok.textContent = 'Aprobar';
      ok.addEventListener('click', async () => {
        try {
          await patchRemote(s.id, { estado: 'aprobado' });
          showFb('Aprobado.');
        } catch (e) {
          showFb(e.message || 'Error', true);
        }
      });
      const obs = document.createElement('button');
      obs.type = 'button';
      obs.className = 'secondary-button hnf-core-card__btn';
      obs.textContent = 'Observar';
      obs.addEventListener('click', async () => {
        try {
          await patchRemote(s.id, { estado: 'observado' });
          showFb('Marcado observado.');
        } catch (e) {
          showFb(e.message || 'Error', true);
        }
      });
      actions.append(ok, obs);
    }

    const histBtn = document.createElement('button');
    histBtn.type = 'button';
    histBtn.className = 'hnf-core-card__link';
    histBtn.textContent = 'Historial';
    histBtn.addEventListener('click', () => openHistorial(s));

    card.append(top, cli, resp, bar, chk, actions, histBtn);
    return card;
  };

  const modalHost = document.createElement('div');
  modalHost.className = 'hnf-core-modal-host';

  const openHistorial = (s) => {
    modalHost.replaceChildren();
    const back = document.createElement('div');
    back.className = 'hnf-core-modal-back';
    const panel = document.createElement('div');
    panel.className = 'hnf-core-modal tarjeta';
    const h = document.createElement('h3');
    h.textContent = `${s.id} · trazabilidad`;
    const ul = document.createElement('ul');
    ul.className = 'hnf-core-modal__hist';
    const hist = Array.isArray(s.historial) ? [...s.historial].reverse() : [];
    if (!hist.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Sin eventos.';
      ul.append(li);
    } else {
      for (const ev of hist) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="muted">${esc(ev.at)}</span> · <strong>${esc(ev.accion)}</strong> — ${esc(ev.detalle)} <span class="muted">(${esc(ev.actor)})</span>`;
        ul.append(li);
      }
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'primary-button';
    close.textContent = 'Cerrar';
    close.addEventListener('click', () => modalHost.replaceChildren());
    back.addEventListener('click', () => modalHost.replaceChildren());
    panel.append(h, ul, close);
    modalHost.append(back, panel);
  };

  const renderKanban = () => {
    const board = document.createElement('div');
    board.className = 'hnf-core-kanban';
    for (const col of HNF_CORE_ESTADO_COLUMNS) {
      const colEl = document.createElement('section');
      colEl.className = 'hnf-core-col';
      const h = document.createElement('h4');
      h.className = 'hnf-core-col__h';
      h.textContent = labelEstadoSolicitud(col);
      const stack = document.createElement('div');
      stack.className = 'hnf-core-col__stack';
      const inCol = filtered.filter((s) => s.estado === col);
      for (const s of inCol) stack.append(renderCard(s));
      colEl.append(h, stack);
      board.append(colEl);
    }
    return board;
  };

  const renderLista = () => {
    const table = document.createElement('div');
    table.className = 'hnf-core-list tarjeta';
    if (!filtered.length) {
      table.innerHTML = '<p class="muted">No hay solicitudes en tu bandeja.</p>';
      return table;
    }
    const tb = document.createElement('table');
    tb.className = 'hnf-core-list__table';
    tb.innerHTML = `<thead><tr><th>ID</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Resp.</th><th>%</th><th></th></tr></thead>`;
    const bodyT = document.createElement('tbody');
    for (const s of filtered) {
      const tr = document.createElement('tr');
      const next = nextEstadoSugerido(s);
      tr.innerHTML = `<td>${esc(s.id)}</td><td>${esc(s.cliente)}</td><td>${esc(s.tipo)}</td><td>${esc(labelEstadoSolicitud(s.estado))}</td><td>${esc(s.responsable)}</td><td>${solicitudProgressPct(s)}%</td><td class="hnf-core-list__act"></td>`;
      const td = tr.querySelector('.hnf-core-list__act');
      if (next) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary-button';
        b.textContent = 'Avanzar';
        b.addEventListener('click', async () => {
          try {
            await patchRemote(s.id, { estado: next });
            showFb('Listo.');
          } catch (e) {
            showFb(e.message || 'Error', true);
          }
        });
        td.append(b);
      }
      bodyT.append(tr);
    }
    tb.append(bodyT);
    table.append(tb);
    return table;
  };

  const renderSolicitudes = () => {
    const wrap = document.createElement('div');
    wrap.className = 'hnf-core-sol';
    if (layout === 'kanban') wrap.append(renderKanban());
    else wrap.append(renderLista());
    return wrap;
  };

  const renderBody = () => {
    body.replaceChildren();
    if (tab === 'finanzas') {
      body.append(renderFinanzas());
      return;
    }
    if (tab === 'equipo') {
      body.append(renderEquipo());
      return;
    }
    body.append(renderSolicitudes());
  };

  const btnKanban = document.createElement('button');
  btnKanban.type = 'button';
  btnKanban.className = 'secondary-button';
  btnKanban.textContent = 'Kanban';
  btnKanban.addEventListener('click', () => {
    layout = 'kanban';
    renderBody();
  });

  const btnLista = document.createElement('button');
  btnLista.type = 'button';
  btnLista.className = 'secondary-button';
  btnLista.textContent = 'Lista';
  btnLista.addEventListener('click', () => {
    layout = 'lista';
    renderBody();
  });

  const btnSync = document.createElement('button');
  btnSync.type = 'button';
  btnSync.className = 'secondary-button';
  btnSync.textContent = 'Actualizar';
  btnSync.addEventListener('click', () => refresh());

  const btnJarvis = document.createElement('button');
  btnJarvis.type = 'button';
  btnJarvis.className = 'secondary-button';
  btnJarvis.textContent = '← Jarvis';
  btnJarvis.addEventListener('click', () => navigateToView?.('jarvis'));

  const form = document.createElement('div');
  form.className = 'hnf-core-new tarjeta';
  form.innerHTML = `<h3 class="hnf-core-new__h">Nueva solicitud</h3>
    <label class="hnf-core-new__lab">Cliente<input class="hnf-core-new__in" name="cliente" type="text" placeholder="Cliente" /></label>
    <label class="hnf-core-new__lab">Tipo
      <select class="hnf-core-new__in" name="tipo">
        <option value="clima">Clima</option>
        <option value="flota">Flota</option>
        <option value="comercial">Comercial</option>
        <option value="control">Control</option>
      </select>
    </label>
    <label class="hnf-core-new__lab">Origen
      <select class="hnf-core-new__in" name="origen">
        <option value="whatsapp">WhatsApp</option>
        <option value="correo">Correo</option>
        <option value="manual">Manual</option>
      </select>
    </label>
    <label class="hnf-core-new__lab">Prioridad
      <select class="hnf-core-new__in" name="prioridad">
        <option value="media">Media</option>
        <option value="baja">Baja</option>
        <option value="alta">Alta</option>
        <option value="critica">Crítica</option>
      </select>
    </label>
    <label class="hnf-core-new__lab">Descripción<textarea class="hnf-core-new__ta" name="descripcion" rows="2"></textarea></label>`;
  const btnCreate = document.createElement('button');
  btnCreate.type = 'button';
  btnCreate.className = 'primary-button';
  btnCreate.textContent = 'Crear';
  btnCreate.addEventListener('click', async () => {
    const cliente = form.querySelector('[name="cliente"]')?.value?.trim() || '';
    const tipo = form.querySelector('[name="tipo"]')?.value || 'clima';
    const origen = form.querySelector('[name="origen"]')?.value || 'manual';
    const prioridad = form.querySelector('[name="prioridad"]')?.value || 'media';
    const descripcion = form.querySelector('[name="descripcion"]')?.value?.trim() || '';
    if (!cliente) {
      showFb('Cliente obligatorio.', true);
      return;
    }
    try {
      const res = await hnfCoreSolicitudesService.create({
        cliente,
        tipo,
        origen,
        prioridad,
        descripcion,
      });
      const row = res?.data ?? res;
      if (row?.id) {
        list.push(row);
        applyLocal([...list]);
        showFb(`Creada ${row.id}`);
      } else throw new Error('No se pudo crear');
    } catch (e) {
      showFb(e.message || 'Error', true);
    }
  });
  form.append(btnCreate);

  toolbar.append(btnJarvis, btnSync, btnKanban, btnLista);

  renderBody();

  root.append(header, tabs, toolbar, feedback, form, body, modalHost);
  return root;
};
