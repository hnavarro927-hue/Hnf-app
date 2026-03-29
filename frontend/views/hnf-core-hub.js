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
import {
  JARVIS_TAB_DEF,
  renderCargaMasivaTab,
  renderClientesTab,
  renderDirectorioTab,
  renderMemoriaTab,
  renderValidacionTab,
} from './hnf-core-jarvis-panels.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const CC_PIPE_STEPS = [
  { label: 'Solicitud' },
  { label: 'Clasificación' },
  { label: 'Asignación' },
  { label: 'Ejecución' },
  { label: 'Informe' },
  { label: 'Cierre' },
];

function pipelineActiveIndex(estado) {
  const e = String(estado || '');
  if (e === 'recibido') return 0;
  if (e === 'en_proceso') return 3;
  if (e === 'pendiente_aprobacion' || e === 'observado') return 2;
  if (e === 'aprobado' || e === 'enviado') return 4;
  if (e === 'cerrado') return 5;
  return 1;
}

function coreCardSemaphoreClass(estado) {
  const e = String(estado || '');
  if (e === 'cerrado') return 'hnf-core-card--sem-cerrado';
  if (e === 'recibido') return 'hnf-core-card--sem-abierto';
  return 'hnf-core-card--sem-proceso';
}

/**
 * Core HNF — solicitudes (Kanban + lista) + pestañas Finanzas / Equipo (datos operativos existentes).
 */
export const hnfCoreHubView = ({
  data,
  reloadApp,
  navigateToView,
} = {}) => {
  const root = document.createElement('div');
  root.className = 'hnf-core-hub hnf-core-hub--command-center';

  const role = resolveOperatorRole();
  const tabDefs = JARVIS_TAB_DEF.filter((d) => d.visible(role));
  let tab = tabDefs.some((d) => d.id === 'solicitudes') ? 'solicitudes' : tabDefs[0]?.id || 'solicitudes';
  if (!tabDefs.some((d) => d.id === tab)) tab = tabDefs[0]?.id || 'solicitudes';
  let layout = 'kanban';
  let list = Array.isArray(data?.hnfCoreSolicitudes) ? [...data.hnfCoreSolicitudes] : [];
  let filtered = filterSolicitudesForRole(list, role);

  let stats = computeHnfCoreSolicitudStats(list);

  const header = document.createElement('header');
  header.className = 'hnf-core-hub__head';
  header.innerHTML = `<h1 class="hnf-core-hub__title">Command Center · Clientes y validación</h1>
    <p class="hnf-core-hub__sub muted">Bandeja inteligente, trazabilidad y módulos operativos · ${stats.lineaNucleo}</p>`;

  let deckRefs = null;

  const syncCommandDeck = () => {
    if (!deckRefs) return;
    const st = computeHnfCoreSolicitudStats(list);
    const climaN = list.filter((x) => x.tipo === 'clima').length;
    const flotaN = list.filter((x) => x.tipo === 'flota' || x.tipo === 'comercial').length;
    const otsN = Array.isArray(data?.planOts)
      ? data.planOts.length
      : Array.isArray(data?.ots?.data)
        ? data.ots.data.length
        : 0;
    deckRefs.climaEl.textContent = `${climaN} solicitudes · ${otsN} OT en corte`;
    deckRefs.flotaEl.textContent = `${flotaN} solicitudes flota/comercial`;
    deckRefs.ctrlEl.textContent = `${st.pendienteAprobacion} aprobación · ${st.observados} observados · ${st.enRiesgo} riesgo`;
  };

  const renderCommandDeck = () => {
    const deck = document.createElement('section');
    deck.className = 'hnf-cc-deck';
    deck.setAttribute('aria-label', 'Módulos Clima, Flota y Gerencia');

    const iconFan = `<svg class="hnf-cc-mod__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
    const iconTruck = `<svg class="hnf-cc-mod__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 16V5H3v11h2m8 0h2m-6 0a2 2 0 104 0m-4 0H7m8 0v-3h4l3 3v3h-3m-7 0a2 2 0 104 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const iconChart = `<svg class="hnf-cc-mod__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 19V5M8 17V9m4 8v-6m4 6v-9m4 13V5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

    const mkCard = ({ modClass, iconHtml, eyebrow, title, lead, statEl, btns }) => {
      const art = document.createElement('article');
      art.className = `hnf-cc-mod ${modClass}`;
      const ic = document.createElement('div');
      ic.className = 'hnf-cc-mod__icon';
      ic.innerHTML = iconHtml;
      const bd = document.createElement('div');
      bd.className = 'hnf-cc-mod__body';
      const eb = document.createElement('p');
      eb.className = 'hnf-cc-mod__eyebrow';
      eb.textContent = eyebrow;
      const h = document.createElement('h2');
      h.className = 'hnf-cc-mod__title';
      h.textContent = title;
      const p = document.createElement('p');
      p.className = 'hnf-cc-mod__lead muted';
      p.textContent = lead;
      const st = document.createElement('p');
      st.className = 'hnf-cc-mod__pulse';
      st.append(statEl);
      const row = document.createElement('div');
      row.className = 'hnf-cc-mod__actions';
      for (const b of btns) row.append(b);
      bd.append(eb, h, p, st, row);
      art.append(ic, bd);
      return art;
    };

    const spanClima = document.createElement('span');
    const spanFlota = document.createElement('span');
    const spanCtrl = document.createElement('span');
    deckRefs = { climaEl: spanClima, flotaEl: spanFlota, ctrlEl: spanCtrl, deck };

    const b = (label, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hnf-cc-mod__chip';
      btn.textContent = label;
      btn.addEventListener('click', onClick);
      return btn;
    };

    deck.append(
      mkCard({
        modClass: 'hnf-cc-mod--clima',
        iconHtml: iconFan,
        eyebrow: 'Operación · Romina',
        title: 'Clima',
        lead: 'Mantención de equipos de climatización y visitas HVAC.',
        statEl: spanClima,
        btns: [
          b('AIRE', () => navigateToView?.('clima')),
          b('TÉCNICO', () => navigateToView?.('clima')),
          b('PREVENTIVO', () => navigateToView?.('clima')),
        ],
      }),
      mkCard({
        modClass: 'hnf-cc-mod--flota',
        iconHtml: iconTruck,
        eyebrow: 'Operación · Gery',
        title: 'Flota',
        lead: 'Mantenciones, traslados, revisiones y trazabilidad 360°.',
        statEl: spanFlota,
        btns: [
          b('LOGÍSTICA', () => navigateToView?.('flota')),
          b('LEGA', () => navigateToView?.('flota')),
          b('TRACKING', () => navigateToView?.('flota')),
        ],
      }),
      mkCard({
        modClass: 'hnf-cc-mod--gerencia',
        iconHtml: iconChart,
        eyebrow: 'Operación · Control',
        title: 'Gerencia',
        lead: 'Supervisión total Romina + Gery y solicitudes entrantes.',
        statEl: spanCtrl,
        btns: [
          b('OMNICANAL', () => navigateToView?.('hnf-core')),
          b('KPIs', () => navigateToView?.('control-gerencial')),
          b('FINANZAS', () => navigateToView?.('finanzas')),
        ],
      })
    );
    syncCommandDeck();
    return deck;
  };

  const renderJarvisBlock = () => {
    const box = document.createElement('section');
    box.className = 'hnf-cc-jarvis';
    box.setAttribute('aria-label', 'Jarvis IA · sugerencias para Control');
    const inner = document.createElement('div');
    inner.className = 'hnf-cc-jarvis__inner';
    inner.innerHTML = `<div class="hnf-cc-jarvis__head">
        <span class="hnf-cc-jarvis__badge">JARVIS IA</span>
        <h3 class="hnf-cc-jarvis__title">Decisiones recomendadas · Control</h3>
      </div>
      <ul class="hnf-cc-jarvis__list" id="hnf-cc-jarvis-lines"></ul>
      <button type="button" class="secondary-button hnf-cc-jarvis__cta" id="hnf-cc-jarvis-open">Abrir Jarvis HQ</button>`;
    const ul = inner.querySelector('#hnf-cc-jarvis-lines');
    const refreshLines = () => {
      const st = computeHnfCoreSolicitudStats(list);
      const lines = [
        st.pendienteAprobacion > 0 &&
          `${st.pendienteAprobacion} solicitud(es) esperando aprobación gerencial — priorizar bandeja.`,
        st.observados > 0 && `${st.observados} caso(s) observados — revisar contexto antes de avanzar.`,
        st.enRiesgo > 0 && `${st.enRiesgo} ítem(s) con prioridad alta/crítica u observado — vigilar SLA.`,
        'Revisá canales WhatsApp / correo en Ingreso y Bandeja para cerrar el circuito omnicanal.',
      ].filter(Boolean);
      ul.replaceChildren();
      for (const line of lines.length ? lines : ['Operación estable. Mantener ritmo de validación y envío a cliente.']) {
        const li = document.createElement('li');
        li.textContent = line;
        ul.append(li);
      }
    };
    refreshLines();
    inner.querySelector('#hnf-cc-jarvis-open')?.addEventListener('click', () => navigateToView?.('jarvis'));
    box.append(inner);
    box.refreshJarvisLines = refreshLines;
    return box;
  };

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
      syncToolbar();
      renderBody();
    });
    return b;
  };

  for (const d of tabDefs) {
    tabs.append(mkTab(d.id, d.label));
  }

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

  let jarvisBlock = null;

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
    if (sub) sub.textContent = `Bandeja inteligente y trazabilidad · ${stats.lineaNucleo}`;
    syncCommandDeck();
    jarvisBlock?.refreshJarvisLines?.();
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
    card.classList.add(coreCardSemaphoreClass(s.estado));
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

    const pipeIdx = pipelineActiveIndex(s.estado);
    const pipeline = document.createElement('div');
    pipeline.className = 'hnf-core-card__pipeline';
    pipeline.setAttribute('aria-label', 'Pipeline operativo');
    CC_PIPE_STEPS.forEach((step, i) => {
      const sp = document.createElement('span');
      sp.className = 'hnf-core-card__pipe-step';
      if (i < pipeIdx) sp.classList.add('hnf-core-card__pipe-step--done');
      else if (i === pipeIdx) sp.classList.add('hnf-core-card__pipe-step--active');
      else sp.classList.add('hnf-core-card__pipe-step--pending');
      sp.textContent = step.label;
      pipeline.append(sp);
    });

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

    card.append(top, cli, pipeline, resp, bar, chk, actions, histBtn);
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
    const host = document.createElement('div');
    host.className = 'hnf-core-list hnf-core-list--cards';
    if (!filtered.length) {
      const p = document.createElement('p');
      p.className = 'muted hnf-core-list--empty';
      p.textContent = 'No hay solicitudes en tu bandeja.';
      host.append(p);
      return host;
    }
    const head = document.createElement('p');
    head.className = 'hnf-core-list--intro muted small';
    head.textContent =
      'Bandeja inteligente en cards: pipeline, semáforo y acciones iguales que en Kanban — orden por llegada en tu rol.';
    host.append(head);
    const grid = document.createElement('div');
    grid.className = 'hnf-core-list__grid';
    const sorted = [...filtered].sort((a, b) =>
      String(a.id || '').localeCompare(String(b.id || ''), 'es', { numeric: true })
    );
    for (const s of sorted) grid.append(renderCard(s));
    host.append(grid);
    return host;
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
    if (tab === 'validacion') {
      body.append(renderValidacionTab(data, role, showFb, refresh));
      return;
    }
    if (tab === 'memoria') {
      body.append(renderMemoriaTab(data));
      return;
    }
    if (tab === 'clientes') {
      body.append(renderClientesTab(data, showFb, refresh));
      return;
    }
    if (tab === 'directorio') {
      body.append(renderDirectorioTab(data, showFb, refresh));
      return;
    }
    if (tab === 'carga') {
      body.append(renderCargaMasivaTab(showFb, refresh));
      return;
    }
    body.append(renderSolicitudes());
  };

  const syncToolbar = () => {
    const sol = tab === 'solicitudes';
    btnKanban.hidden = !sol;
    btnLista.hidden = !sol;
    form.hidden = !sol;
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

  syncToolbar();
  renderBody();

  const commandDeck = renderCommandDeck();
  jarvisBlock = renderJarvisBlock();

  root.append(header, commandDeck, jarvisBlock, tabs, toolbar, feedback, form, body, modalHost);
  return root;
};
