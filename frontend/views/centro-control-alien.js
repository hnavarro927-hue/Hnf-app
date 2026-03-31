import '../styles/centro-control-alien.css';
import { KANBAN_LANE_IDS, mapOtToLane } from '../domain/ot-kanban-lanes.js';
import { alertaOperativaVisual } from '../domain/hnf-operativa-reglas.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

const LANE_LABEL = {
  ingreso: 'Ingreso',
  en_proceso: 'En proceso',
  pendiente_aprobacion: 'Pend. aprobación',
  observado: 'Observado',
  aprobado: 'Aprobado',
  enviado: 'Enviado',
  cerrado: 'Cerrado',
};

function fmtCLP(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(Math.round(n));
  }
}

function computeKpisDesdeOts(otsRaw) {
  const list = Array.isArray(otsRaw) ? otsRaw : [];
  if (!list.length) {
    return {
      ingresos: { text: 'Sin dato', pending: true },
      costos: { text: 'Sin dato', pending: true },
      margen: { text: 'Sin dato', pending: true },
      activas: '0',
      riesgo: '0',
      sinEvidencia: '0',
    };
  }

  let sumCobro = 0;
  let nCobro = 0;
  let sumCosto = 0;
  let nCosto = 0;
  let sumUtil = 0;
  let nUtil = 0;

  const terminal = new Set(['cerrada', 'finalizada', 'facturada']);
  let activas = 0;
  let riesgo = 0;
  let sinEv = 0;

  for (const o of list) {
    const est = String(o?.estado || '').toLowerCase();
    if (!terminal.has(est)) activas += 1;

    const mc = Number(o?.montoCobrado);
    if (Number.isFinite(mc) && mc > 0) {
      sumCobro += mc;
      nCobro += 1;
    }
    const ct = Number(o?.costoTotal);
    if (Number.isFinite(ct) && ct >= 0) {
      sumCosto += ct;
      nCosto += 1;
    }
    const ut = Number(o?.utilidad);
    if (Number.isFinite(ut)) {
      sumUtil += ut;
      nUtil += 1;
    }

    const av = alertaOperativaVisual(o, {});
    if (av?.tipo === 'riesgo') riesgo += 1;
    if (getEvidenceGaps(o).length > 0) sinEv += 1;
  }

  const ingresos = nCobro ? { text: fmtCLP(sumCobro), pending: false } : { text: 'Sin dato', pending: true };
  const costos = nCosto ? { text: fmtCLP(sumCosto), pending: false } : { text: 'Sin dato', pending: true };

  let margen = { text: 'Sin dato', pending: true };
  if (nCobro && sumCobro > 0 && nUtil) {
    const ratio = sumUtil / sumCobro;
    margen = { text: `${(ratio * 100).toFixed(1)}%`, pending: false };
  }

  return {
    ingresos,
    costos,
    margen,
    activas: String(activas),
    riesgo: String(riesgo),
    sinEvidencia: String(sinEv),
  };
}

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function kpiCard(label, valueObj) {
  const card = el('hnf-cc__kpi-card');
  const lb = el('hnf-cc__kpi-label');
  lb.textContent = label;
  const val = el('hnf-cc__kpi-value');
  if (valueObj.pending) {
    val.classList.add('hnf-cc__kpi-value--pending');
    val.textContent = valueObj.text === 'Sin dato' ? 'Sin dato' : valueObj.text;
  } else {
    val.textContent = valueObj.text;
  }
  card.append(lb, val);
  return card;
}

function cardTipoClass(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'clima') return 'hnf-cc__card--clima';
  if (t === 'flota') return 'hnf-cc__card--flota';
  return '';
}

function renderHistorial(ot) {
  const h = Array.isArray(ot?.historial) ? ot.historial : [];
  const frag = document.createDocumentFragment();
  if (!h.length) {
    const p = el('', 'p');
    p.textContent = '—';
    frag.append(p);
    return frag;
  }
  [...h].reverse().slice(0, 12).forEach((entry) => {
    const li = el('hnf-cc__hist-li', 'div');
    const head = `${String(entry?.at || '').slice(0, 19)} · ${String(entry?.accion || '')}`;
    li.textContent = head;
    if (entry?.detalle) {
      const d = el('', 'p');
      d.style.marginTop = '0.25rem';
      d.style.color = '#a1a1aa';
      d.style.fontSize = '0.58rem';
      d.textContent = String(entry.detalle).slice(0, 200);
      li.append(d);
    }
    frag.append(li);
  });
  return frag;
}

function renderTabBody(ot, tabId) {
  const wrap = el('');
  if (tabId === 'detalle') {
    const rows = [
      ['Cliente', ot.cliente],
      ['Tipo', ot.tipoServicio],
      ['Estado', ot.estado],
      ['Resp.', ot.responsableActual || ot.tecnicoAsignado],
      ['Lyn', ot.aprobacionLynEstado],
    ];
    rows.forEach(([k, v]) => {
      const r = el('hnf-cc__row');
      const a = el('hnf-cc__row-k', 'span');
      a.textContent = k;
      const b = el('hnf-cc__row-k', 'span');
      b.style.fontWeight = '500';
      b.style.textTransform = 'none';
      b.style.color = '#e4e4e7';
      b.textContent = v != null && String(v).trim() ? String(v) : '—';
      r.append(a, b);
      wrap.append(r);
    });
  } else if (tabId === 'costos') {
    const rows = [
      ['Total', ot.costoTotal],
      ['Cobro', ot.montoCobrado],
      ['Util.', ot.utilidad],
    ];
    rows.forEach(([k, v]) => {
      const r = el('hnf-cc__row');
      const a = el('hnf-cc__row-k', 'span');
      a.textContent = k;
      const b = el('hnf-cc__row-k', 'span');
      b.style.fontWeight = '500';
      b.style.textTransform = 'none';
      b.style.color = '#e4e4e7';
      b.textContent = v != null && v !== '' ? String(v) : '—';
      r.append(a, b);
      wrap.append(r);
    });
  } else if (tabId === 'evidencia') {
    const gaps = getEvidenceGaps(ot);
    const p = el('', 'p');
    p.style.color = '#a1a1aa';
    p.style.fontSize = '0.65rem';
    p.textContent = gaps.length ? `${gaps.length} falta(s) evidencia` : 'Sin brechas detectadas';
    wrap.append(p);
  } else if (tabId === 'historial') {
    wrap.append(renderHistorial(ot));
  }
  return wrap;
}

/**
 * Centro de control operativo (Modo Alien) — esqueleto visual, datos reales desde GET /ots.
 * @param {{ data?: object, reloadApp?: function, navigateToView?: function }} props
 */
export function centroControlAlienView(props) {
  const { data, reloadApp, navigateToView } = props || {};
  const otsEnvelope = data?.ots;
  const ots = Array.isArray(otsEnvelope?.data) ? otsEnvelope.data : Array.isArray(otsEnvelope) ? otsEnvelope : [];

  const section = el('hnf-cc', 'section');
  section.setAttribute('aria-label', 'Centro de control operativo');

  const kpis = computeKpisDesdeOts(ots);
  const kpiRow = el('hnf-cc__kpi');
  kpiRow.append(
    kpiCard('Ingresos', kpis.ingresos),
    kpiCard('Costos', kpis.costos),
    kpiCard('Margen', kpis.margen),
    kpiCard('OT activas', { text: kpis.activas, pending: false }),
    kpiCard('OT riesgo', { text: kpis.riesgo, pending: false }),
    kpiCard('Sin evidencia', { text: kpis.sinEvidencia, pending: false })
  );

  const ux = el('hnf-cc__ux');
  ['Ver', 'Entender', 'Actuar'].forEach((label, i) => {
    if (i > 0) {
      const ar = el('hnf-cc__ux-arr', 'span');
      ar.textContent = '→';
      ux.append(ar);
    }
    const s = el('hnf-cc__ux-step', 'span');
    s.textContent = label;
    ux.append(s);
  });

  const roles = el('hnf-cc__roles-hint');
  ['Romina → Clima', 'Gery → Flota', 'Lyn / Hernán → Gerencia'].forEach((t) => {
    const p = el('hnf-cc__role-pill', 'span');
    p.textContent = t;
    roles.append(p);
  });

  const toolbar = el('hnf-cc__toolbar');
  const tbTitle = el('hnf-cc__toolbar-title');
  tbTitle.textContent = 'Kanban OT';
  const sync = el('hnf-cc__btn', 'button');
  sync.type = 'button';
  sync.textContent = 'Actualizar';
  sync.addEventListener('click', () => {
    if (typeof reloadApp === 'function') void reloadApp();
  });
  toolbar.append(tbTitle, sync);

  const body = el('hnf-cc__body');
  const main = el('hnf-cc__main');

  const byLane = Object.fromEntries(KANBAN_LANE_IDS.map((k) => [k, []]));
  for (const ot of ots) {
    const lane = mapOtToLane(ot);
    if (byLane[lane]) byLane[lane].push(ot);
    else byLane.ingreso.push(ot);
  }

  let mobileLane = 0;
  const lanesEl = el('hnf-cc__lanes');

  const mobileNav = el('hnf-cc__mobile-lane-nav');
  const prevB = el('hnf-cc__btn', 'button');
  prevB.type = 'button';
  prevB.textContent = '◀';
  const mobileTitle = el('hnf-cc__toolbar-title');
  mobileTitle.style.textAlign = 'center';
  mobileTitle.style.flex = '1';
  const nextB = el('hnf-cc__btn', 'button');
  nextB.type = 'button';
  nextB.textContent = '▶';
  mobileNav.append(prevB, mobileTitle, nextB);

  const dots = el('hnf-cc__dots');

  const scrollToLane = (idx) => {
    const i = Math.max(0, Math.min(KANBAN_LANE_IDS.length - 1, idx));
    mobileLane = i;
    const col = lanesEl.children[i];
    col?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    mobileTitle.textContent = LANE_LABEL[KANBAN_LANE_IDS[i]];
    prevB.disabled = i <= 0;
    nextB.disabled = i >= KANBAN_LANE_IDS.length - 1;
    dots.querySelectorAll('.hnf-cc__dot').forEach((d, di) => {
      d.classList.toggle('hnf-cc__dot--on', di === i);
    });
  };

  prevB.addEventListener('click', () => scrollToLane(mobileLane - 1));
  nextB.addEventListener('click', () => scrollToLane(mobileLane + 1));

  KANBAN_LANE_IDS.forEach((laneId, idx) => {
    const lane = el('hnf-cc__lane');
    const head = el('hnf-cc__lane-head');
    const t = el('hnf-cc__lane-title');
    t.textContent = LANE_LABEL[laneId];
    const c = el('hnf-cc__lane-count');
    c.textContent = String((byLane[laneId] || []).length);
    head.append(t, c);
    const cards = el('hnf-cc__lane-cards');
    for (const ot of byLane[laneId] || []) {
      const btn = el(`hnf-cc__card ${cardTipoClass(ot.tipoServicio)}`, 'button');
      btn.type = 'button';
      const row = el('hnf-cc__card-row');
      const id = el('hnf-cc__card-id', 'span');
      id.textContent = String(ot.id || '');
      const tipo = el('hnf-cc__card-tipo', 'span');
      tipo.textContent = String(ot.tipoServicio || '—');
      row.append(id, tipo);
      const cli = el('hnf-cc__card-cliente', 'div');
      cli.textContent = String(ot.cliente || '').trim() || '—';
      const meta = el('hnf-cc__card-meta');
      meta.textContent = String(ot.responsableActual || ot.tecnicoAsignado || '—').trim();
      const est = el('hnf-cc__card-estado', 'span');
      est.textContent = String(ot.estado || '—');
      btn.append(row, cli, meta, est);
      const av = alertaOperativaVisual(ot, {});
      if (av) {
        const al = el(`hnf-cc__alert hnf-cc__alert--${av.tipo === 'riesgo' ? 'risk' : 'delay'}`);
        al.textContent = av.texto != null && String(av.texto).trim() ? String(av.texto) : '—';
        btn.append(al);
      }
      btn.addEventListener('click', () => openDrawer(ot, btn));
      cards.append(btn);
    }
    lane.append(head, cards);
    lanesEl.append(lane);

    const dot = el(idx === 0 ? 'hnf-cc__dot hnf-cc__dot--on' : 'hnf-cc__dot', 'button');
    dot.type = 'button';
    dot.setAttribute('aria-label', LANE_LABEL[laneId]);
    dot.addEventListener('click', () => scrollToLane(idx));
    dots.append(dot);
  });

  lanesEl.addEventListener('scroll', () => {
    if (lanesEl.scrollWidth <= lanesEl.clientWidth + 8) return;
    const w = lanesEl.clientWidth || 1;
    const idx = Math.round(lanesEl.scrollLeft / w);
    if (idx !== mobileLane && idx >= 0 && idx < KANBAN_LANE_IDS.length) {
      mobileLane = idx;
      mobileTitle.textContent = LANE_LABEL[KANBAN_LANE_IDS[idx]];
      prevB.disabled = idx <= 0;
      nextB.disabled = idx >= KANBAN_LANE_IDS.length - 1;
      dots.querySelectorAll('.hnf-cc__dot').forEach((d, di) => d.classList.toggle('hnf-cc__dot--on', di === idx));
    }
  });

  mobileTitle.textContent = LANE_LABEL[KANBAN_LANE_IDS[0]];
  prevB.disabled = true;

  main.append(mobileNav, dots, lanesEl);

  const backdrop = el('hnf-cc__drawer-backdrop', 'button');
  backdrop.type = 'button';
  backdrop.setAttribute('aria-label', 'Cerrar panel');

  const drawer = el('hnf-cc__drawer');
  const dHead = el('hnf-cc__drawer-head');
  const dTitle = el('', 'div');
  const idEl = el('', 'p');
  idEl.style.margin = '0';
  idEl.style.fontFamily = 'ui-monospace,monospace';
  idEl.style.fontWeight = '700';
  idEl.style.fontSize = '0.8rem';
  idEl.style.color = '#22d3ee';
  const sub = el('', 'p');
  sub.style.margin = '0.15rem 0 0';
  sub.style.fontSize = '0.65rem';
  sub.style.color = '#71717a';
  dTitle.append(idEl, sub);
  const closeBtn = el('hnf-cc__btn', 'button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.style.minWidth = '2.25rem';
  dHead.append(dTitle, closeBtn);

  const tabsRow = el('hnf-cc__drawer-tabs');
  const tabIds = [
    ['detalle', 'Detalle'],
    ['costos', 'Costos'],
    ['evidencia', 'Evidencia'],
    ['historial', 'Historial'],
  ];
  let activeTab = 'detalle';
  const tabBodies = el('hnf-cc__drawer-body');

  const actRow = el('hnf-cc__act-row');
  const foot = el('hnf-cc__drawer-foot');
  foot.textContent = 'Kanban visible · acciones en módulos';

  let selectedBtn = null;
  let currentOt = null;
  let escHandler = null;

  const setActiveCard = (btn) => {
    if (selectedBtn) selectedBtn.classList.remove('hnf-cc__card--active');
    selectedBtn = btn;
    if (selectedBtn) selectedBtn.classList.add('hnf-cc__card--active');
  };

  function renderTabs() {
    tabsRow.replaceChildren();
    tabIds.forEach(([id, label]) => {
      const b = el(`hnf-cc__drawer-tab${id === activeTab ? ' hnf-cc__drawer-tab--on' : ''}`, 'button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => {
        activeTab = id;
        renderTabs();
        tabBodies.replaceChildren(renderTabBody(currentOt, activeTab));
      });
      tabsRow.append(b);
    });
  }

  function renderActuar(ot) {
    actRow.replaceChildren();
    const t = String(ot?.tipoServicio || '').toLowerCase();
    if (t === 'clima') {
      const b = el('hnf-cc__act-btn', 'button');
      b.type = 'button';
      b.textContent = 'Ir a Clima';
      b.addEventListener('click', () => navigateToView?.('clima'));
      actRow.append(b);
    } else if (t === 'flota') {
      const b = el('hnf-cc__act-btn', 'button');
      b.type = 'button';
      b.textContent = 'Ir a Flota';
      b.addEventListener('click', () => navigateToView?.('flota'));
    } else {
      const b = el('hnf-cc__act-btn', 'button');
      b.type = 'button';
      b.textContent = 'Ingreso';
      b.addEventListener('click', () => navigateToView?.('ingreso-operativo'));
      actRow.append(b);
    }
  }

  function closeDrawer() {
    drawer.classList.remove('hnf-cc__drawer--open');
    backdrop.classList.remove('hnf-cc__drawer-backdrop--open');
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
    setActiveCard(null);
    currentOt = null;
  }

  function openDrawer(ot, btn) {
    currentOt = ot;
    idEl.textContent = String(ot.id || '');
    sub.textContent = String(ot.cliente || '').trim() || '—';
    activeTab = 'detalle';
    renderTabs();
    tabBodies.replaceChildren(renderTabBody(ot, activeTab));
    renderActuar(ot);
    drawer.classList.add('hnf-cc__drawer--open');
    backdrop.classList.add('hnf-cc__drawer-backdrop--open');
    if (escHandler) document.removeEventListener('keydown', escHandler);
    escHandler = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', escHandler);
    setActiveCard(btn);
  }

  closeBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  drawer.append(dHead, tabsRow, tabBodies, actRow, foot);

  body.append(main, backdrop, drawer);
  section.append(kpiRow, ux, roles, toolbar, body);

  return section;
}
