import '../styles/centro-control-alien.css';
import { buildJarvisDecisionCard } from '../components/jarvis-decision-card.js';
import { getSessionBackendRole } from '../config/session-bridge.js';
import { KANBAN_LANE_IDS, mapOtToLane } from '../domain/ot-kanban-lanes.js';
import {
  alertaOperativaVisual,
  etiquetaOrigenSolicitudOperativa,
  filtrarOtsPorRolBackend,
  HEURISTICA_OPERATIVA_V1,
  jarvisCopilotFrasesOperativas,
  jarvisHeuristicaPrioridadOperativa,
  textoResponsableOperativoMostrado,
} from '../domain/hnf-operativa-reglas.js';
import { esOtExcluidaDeKpis } from '../domain/ot-kpi-audit.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

const ALERTA_OPTS_CENTRO = HEURISTICA_OPERATIVA_V1;

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

function computeKpisDesdeOts(otsRaw, alertOpts = ALERTA_OPTS_CENTRO) {
  const list = (Array.isArray(otsRaw) ? otsRaw : []).filter((o) => !esOtExcluidaDeKpis(o));
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

    const av = alertaOperativaVisual(o, alertOpts);
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

function kpiCard(label, valueObj, variant = '') {
  const card = el(`hnf-cc__kpi-card${variant ? ` hnf-cc__kpi-card--${variant}` : ''}`);
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

function historialAccionGlyph(accion) {
  const a = String(accion || '').toLowerCase();
  if (a === 'alta') return '●';
  if (a.startsWith('jarvis_origen')) return '◎';
  if (a.startsWith('jarvis_asignacion')) return '◆';
  if (a.startsWith('jarvis_prioridad')) return '⚡';
  if (a.startsWith('jarvis')) return '◇';
  if (a === 'estado') return '→';
  if (a === 'asignacion' || a === 'responsable') return '👤';
  if (a.includes('lyn')) return '✓';
  if (a === 'operacion') return '⚙';
  if (a === 'envio_cliente') return '✉';
  return '·';
}

function jarvisStripLineasCompactas(ot) {
  const origen = etiquetaOrigenSolicitudOperativa(ot.origenSolicitud, ot.origenPedido);
  const resp = textoResponsableOperativoMostrado(ot);
  const h = jarvisHeuristicaPrioridadOperativa(ot);
  const av = alertaOperativaVisual(ot, ALERTA_OPTS_CENTRO);
  const out = [
    `${origen} · ${resp} · Sugerida: ${h.nivel}`,
    av
      ? av.tipo === 'riesgo'
        ? `Riesgo: ${av.texto}`
        : `Atraso: ${av.texto}`
      : 'Sin alerta operativa activa',
  ];
  return out;
}

function cardTipoClass(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'clima') return 'hnf-cc__card--clima';
  if (t === 'flota') return 'hnf-cc__card--flota';
  return '';
}

function renderHistorial(ot) {
  const frag = document.createDocumentFragment();
  const vivo = el('hnf-cc__hist-vivo');
  const vt = el('hnf-cc__hist-vivo-title', 'p');
  vt.textContent = 'Ahora';
  vivo.append(vt);
  for (const line of jarvisCopilotFrasesOperativas(ot)) {
    const row = el('hnf-cc__hist-vivo-row');
    const g = el('hnf-cc__hist-vivo-glyph', 'span');
    g.textContent = '◈';
    const p = el('hnf-cc__hist-vivo-line', 'p');
    p.textContent = line;
    row.append(g, p);
    vivo.append(row);
  }
  frag.append(vivo);

  const h = Array.isArray(ot?.historial) ? ot.historial : [];
  const sep = el('hnf-cc__hist-sep', 'p');
  sep.textContent = 'Registro';
  frag.append(sep);

  if (!h.length) {
    const p = el('hnf-cc__hist-empty', 'p');
    p.textContent = 'Sin eventos persistidos.';
    frag.append(p);
    return frag;
  }
  [...h].reverse().slice(0, 14).forEach((entry) => {
    const li = el('hnf-cc__hist-li', 'div');
    const glyph = el('hnf-cc__hist-li-glyph', 'span');
    glyph.textContent = historialAccionGlyph(entry?.accion);
    const body = el('hnf-cc__hist-li-body');
    const head = el('hnf-cc__hist-li-head');
    head.textContent = `${String(entry?.at || '').slice(0, 19)} · ${String(entry?.accion || 'evento')}`;
    body.append(head);
    if (entry?.detalle) {
      const d = el('hnf-cc__hist-li-detail', 'p');
      d.textContent = String(entry.detalle).slice(0, 220);
      body.append(d);
    }
    li.append(glyph, body);
    frag.append(li);
  });
  return frag;
}

function renderTabBody(ot, tabId) {
  const wrap = el('');
  if (tabId === 'detalle') {
    const priH = jarvisHeuristicaPrioridadOperativa(ot);
    const rows = [
      ['Tipo', ot.tipoServicio],
      ['Subtipo', ot.subtipoServicio],
      ['Estado', ot.estado],
      ['Prioridad operativa', ot.prioridadOperativa || '—'],
      ['Prioridad sugerida (Jarvis)', ot.prioridadSugerida || '—'],
      ['Riesgo detectado (Jarvis)', ot.riesgoDetectado ? 'Sí' : 'No'],
      ['Sugerencia heurística', `${priH.nivel} · ${priH.motivos.slice(0, 4).join(', ') || '—'}`],
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
  const { data, reloadApp, navigateToView, actions } = props || {};
  const otsEnvelope = data?.ots;
  const otsRaw = Array.isArray(otsEnvelope?.data)
    ? otsEnvelope.data
    : Array.isArray(otsEnvelope)
      ? otsEnvelope
      : [];
  const br = getSessionBackendRole() || 'admin';
  const ots = filtrarOtsPorRolBackend(otsRaw, br);

  const section = el('hnf-cc hnf-op-view hnf-op-view--mando', 'section');
  section.setAttribute('aria-label', 'Centro de control operativo');

  const kpis = computeKpisDesdeOts(ots, ALERTA_OPTS_CENTRO);
  const kpiWrap = el('hnf-cc__kpi-wrap');
  const kpiCritical = el('hnf-cc__kpi-row hnf-cc__kpi-row--critical');
  kpiCritical.append(
    kpiCard('Riesgo', { text: kpis.riesgo, pending: false }, 'risk'),
    kpiCard('Sin evid.', { text: kpis.sinEvidencia, pending: false }, 'warn'),
    kpiCard('Activas', { text: kpis.activas, pending: false }, 'active')
  );
  const kpiEcon = el('hnf-cc__kpi-row hnf-cc__kpi-row--econ');
  kpiEcon.append(
    kpiCard('Ingresos', kpis.ingresos),
    kpiCard('Costos', kpis.costos),
    kpiCard('Margen', kpis.margen)
  );
  kpiWrap.append(kpiCritical, kpiEcon);

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
  roles.setAttribute('aria-label', 'Ámbitos por rol');
  ['R→Clima', 'G→Flota', 'L/H→Todo'].forEach((t) => {
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
    const nLane = (byLane[laneId] || []).length;
    c.textContent = String(nLane);
    head.append(t, c);
    const cards = el('hnf-cc__lane-cards');
    for (const ot of byLane[laneId] || []) {
      const shell = el(`hnf-cc__card ${cardTipoClass(ot.tipoServicio)}`);
      const tap = el('hnf-cc__card-tap', 'button');
      tap.type = 'button';
      tap.setAttribute('aria-label', `Abrir detalle ${String(ot.id || '')}`);
      const row = el('hnf-cc__card-row');
      const id = el('hnf-cc__card-id', 'span');
      id.textContent = String(ot.id || '');
      const tipo = el('hnf-cc__card-tipo', 'span');
      tipo.textContent = String(ot.tipoServicio || '—');
      row.append(id, tipo);
      const cli = el('hnf-cc__card-cliente', 'div');
      cli.textContent = String(ot.cliente || '').trim() || '—';
      const badges = el('hnf-cc__card-badges');
      const orig = el('hnf-cc__badge hnf-cc__badge--orig', 'span');
      orig.textContent = etiquetaOrigenSolicitudOperativa(ot.origenSolicitud, ot.origenPedido);
      const pri = el('hnf-cc__badge hnf-cc__badge--pri', 'span');
      pri.textContent = String(ot.prioridadOperativa || '—').toUpperCase();
      badges.append(orig, pri);
      const av = alertaOperativaVisual(ot, ALERTA_OPTS_CENTRO);
      if (av) {
        const dot = el(
          `hnf-cc__badge hnf-cc__badge--alert hnf-cc__badge--${av.tipo === 'riesgo' ? 'risk' : 'delay'}`,
          'span'
        );
        dot.textContent = av.tipo === 'riesgo' ? '!' : '⏱';
        dot.title = av.texto || '';
        badges.append(dot);
      }
      const meta = el('hnf-cc__card-meta');
      meta.textContent = textoResponsableOperativoMostrado(ot);
      const est = el('hnf-cc__card-estado', 'span');
      est.textContent = String(ot.estado || '—');
      tap.append(row, cli, badges, meta, est);
      if (av) {
        const al = el(`hnf-cc__alert hnf-cc__alert--${av.tipo === 'riesgo' ? 'risk' : 'delay'}`);
        al.textContent = av.texto != null && String(av.texto).trim() ? String(av.texto) : '—';
        tap.append(al);
      }
      tap.addEventListener('click', () => openDrawer(ot, shell));

      shell.append(tap);
      shell.append(buildJarvisDecisionCard(ot, { variant: 'compact' }));

      const actRow = el('hnf-cc__card-actions');
      const bAsig = el('hnf-cc__card-act', 'button');
      bAsig.type = 'button';
      bAsig.textContent = 'Asignar';
      bAsig.addEventListener('click', (e) => {
        e.stopPropagation();
        const ts = String(ot.tipoServicio || '').toLowerCase();
        if (ts === 'flota') navigateToView?.('bandeja-gery');
        else navigateToView?.('bandeja-romina');
      });
      const bEst = el('hnf-cc__card-act hnf-cc__card-act--ghost', 'button');
      bEst.type = 'button';
      bEst.textContent = 'Cambiar estado';
      bEst.addEventListener('click', (e) => {
        e.stopPropagation();
        const ts = String(ot.tipoServicio || '').toLowerCase();
        if (ts === 'flota') navigateToView?.('flota');
        else navigateToView?.('clima', { otId: ot.id });
      });
      const bDet = el('hnf-cc__card-act hnf-cc__card-act--ghost', 'button');
      bDet.type = 'button';
      bDet.textContent = 'Ver detalle';
      bDet.addEventListener('click', (e) => {
        e.stopPropagation();
        openDrawer(ot, shell);
      });
      actRow.append(bAsig, bEst, bDet);
      shell.append(actRow);

      cards.append(shell);
    }
    if (!nLane) {
      const empty = el('hnf-cc__lane-empty', 'p');
      empty.textContent = 'Sin OT';
      cards.append(empty);
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
  const drawerHandle = el('hnf-cc__drawer-handle');
  drawerHandle.setAttribute('aria-hidden', 'true');

  const dHead = el('hnf-cc__drawer-head');
  const dTitle = el('hnf-cc__drawer-title-block');
  const idEl = el('hnf-cc__drawer-ot-id', 'p');
  const sub = el('hnf-cc__drawer-cliente', 'p');
  dTitle.append(idEl, sub);
  const closeBtn = el('hnf-cc__drawer-close hnf-cc__btn', 'button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar panel');
  closeBtn.textContent = '✕';
  dHead.append(dTitle, closeBtn);

  const drawerSummary = el('hnf-cc__drawer-summary');

  const jarvisStrip = el('hnf-cc__jarvis-strip');
  jarvisStrip.setAttribute('aria-label', 'Jarvis operativo');

  const tabsRow = el('hnf-cc__drawer-tabs');
  const tabIds = [
    ['detalle', 'Detalle', 'Info'],
    ['costos', 'Costos', '$'],
    ['evidencia', 'Evidencia', 'Fotos'],
    ['historial', 'Historial', 'Log'],
  ];
  let activeTab = 'detalle';
  const tabBodies = el('hnf-cc__drawer-body');

  const actRow = el('hnf-cc__act-row');
  const foot = el('hnf-cc__drawer-foot');
  foot.textContent = 'Módulos para ejecutar';

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
    tabIds.forEach(([id, label, short]) => {
      const b = el(`hnf-cc__drawer-tab${id === activeTab ? ' hnf-cc__drawer-tab--on' : ''}`, 'button');
      b.type = 'button';
      const lf = el('hnf-cc__drawer-tab-long', 'span');
      lf.textContent = label;
      const sh = el('hnf-cc__drawer-tab-short', 'span');
      sh.textContent = short || label;
      b.append(lf, sh);
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
    const mk = (label, fn) => {
      const b = el('hnf-cc__act-btn', 'button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    if (t === 'clima') {
      actRow.append(
        mk('Ir a Clima', () => navigateToView?.('clima', { otId: ot.id })),
        mk('Bandeja Romina', () => navigateToView?.('bandeja-romina'))
      );
    } else if (t === 'flota') {
      actRow.append(
        mk('Ir a Flota', () => navigateToView?.('flota')),
        mk('Bandeja Gery', () => navigateToView?.('bandeja-gery'))
      );
    } else {
      actRow.append(mk('Ingreso operativo', () => navigateToView?.('ingreso-operativo')));
    }
    if (typeof actions?.selectOT === 'function') {
      actRow.append(
        mk('Fijar OT en shell', () => {
          actions.selectOT(ot.id);
        })
      );
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

  function fillDrawerSummary(ot) {
    drawerSummary.replaceChildren();
    const mk = (cls, text) => {
      const s = el(`hnf-cc__sum-chip ${cls}`, 'span');
      s.textContent = text;
      return s;
    };
    drawerSummary.append(
      mk('hnf-cc__sum-chip--estado', String(ot.estado || '—')),
      mk('hnf-cc__sum-chip--origen', etiquetaOrigenSolicitudOperativa(ot.origenSolicitud, ot.origenPedido)),
      mk('hnf-cc__sum-chip--resp', textoResponsableOperativoMostrado(ot)),
      mk(
        'hnf-cc__sum-chip--pri',
        `P ${String(ot.prioridadOperativa || '—').toUpperCase()}`
      )
    );
  }

  function fillJarvisStrip(ot) {
    jarvisStrip.replaceChildren();
    jarvisStrip.append(buildJarvisDecisionCard(ot, { variant: 'full' }));
    const t0 = el('hnf-cc__jarvis-strip-title', 'span');
    t0.textContent = 'Copiloto';
    t0.style.marginTop = '0.35rem';
    jarvisStrip.append(t0);
    for (const line of jarvisStripLineasCompactas(ot)) {
      const p = el('hnf-cc__jarvis-strip-line', 'p');
      p.textContent = line;
      jarvisStrip.append(p);
    }
  }

  function openDrawer(ot, btn) {
    currentOt = ot;
    idEl.textContent = String(ot.id || '');
    sub.textContent = String(ot.cliente || '').trim() || '—';
    fillDrawerSummary(ot);
    fillJarvisStrip(ot);
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

  drawer.append(drawerHandle, dHead, drawerSummary, actRow, jarvisStrip, tabsRow, tabBodies, foot);

  body.append(main, backdrop, drawer);
  section.append(kpiWrap, ux, roles, toolbar, body);

  return section;
}
