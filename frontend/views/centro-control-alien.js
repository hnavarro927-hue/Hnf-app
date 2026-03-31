import '../styles/centro-control-alien.css';
import '../styles/hnf-operational-kanban.css';
import { buildJarvisDecisionCard } from '../components/jarvis-decision-card.js';
import { createJarvisPanel } from '../components/jarvis-panel.js';
import { createKanbanBoard, DEFAULT_KANBAN_LANE_LABELS } from '../components/kanban-board.js';
import { getSessionBackendRole } from '../config/session-bridge.js';
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

function kpiPill(label, value) {
  const d = el('hnf-op-kpi');
  const k = el('hnf-op-kpi__k');
  k.textContent = label;
  const v = el('hnf-op-kpi__v');
  v.textContent = value;
  d.append(k, v);
  return d;
}

/**
 * Centro de control: layout operativo + KanbanBoard + JarvisPanel + drawer detalle.
 * Datos: GET /ots (vía props.data).
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

  const section = el('hnf-cc hnf-op-shell hnf-op-view hnf-op-view--mando', 'section');
  section.setAttribute('aria-label', 'Centro de control operativo');

  const kpis = computeKpisDesdeOts(ots, ALERTA_OPTS_CENTRO);

  const header = el('hnf-op-header');
  const headLeft = el('');
  const hTitle = el('hnf-op-header__title', 'h1');
  hTitle.textContent = 'Operación HNF';
  const hSub = el('hnf-op-header__sub', 'p');
  hSub.textContent = 'Kanban OT · Jarvis · datos en vivo';
  headLeft.append(hTitle, hSub);
  const headAct = el('hnf-op-header__actions');
  const sync = el('hnf-op-btn hnf-op-btn--primary', 'button');
  sync.type = 'button';
  sync.textContent = 'Actualizar';
  sync.addEventListener('click', () => {
    if (typeof reloadApp === 'function') void reloadApp();
  });
  headAct.append(sync);
  header.append(headLeft, headAct);

  const alerts = el('hnf-op-alerts');
  const nRiesgo = Number(kpis.riesgo) || 0;
  const nSinEv = Number(kpis.sinEvidencia) || 0;
  alerts.textContent = `Activas ${kpis.activas} · Alerta riesgo ${kpis.riesgo} · Sin evidencia ${kpis.sinEvidencia}`;
  if (nRiesgo > 0 || nSinEv > 0) alerts.classList.add('hnf-op-alerts--warn');

  const kpiRow = el('hnf-op-kpis');
  kpiRow.append(
    kpiPill('Activas', kpis.activas),
    kpiPill('Riesgo', kpis.riesgo),
    kpiPill('Sin evid.', kpis.sinEvidencia),
    kpiPill('Margen', kpis.margen.pending ? '—' : kpis.margen.text)
  );

  const workspace = el('hnf-op-workspace');
  const mainCol = el('hnf-op-workspace__main');
  const asideCol = el('hnf-op-workspace__aside');

  const jarvisPanel = createJarvisPanel();

  let kanbanSetActive = () => {};

  const { element: boardEl, setActiveShell } = createKanbanBoard({
    ots,
    laneLabels: DEFAULT_KANBAN_LANE_LABELS,
    onSelectOt: (ot) => {
      jarvisPanel.setOt(ot);
    },
    onAssignTech: (ot) => {
      const ts = String(ot.tipoServicio || '').toLowerCase();
      if (ts === 'flota') navigateToView?.('bandeja-gery');
      else navigateToView?.('bandeja-romina');
    },
    onChangeState: (ot) => {
      const ts = String(ot.tipoServicio || '').toLowerCase();
      if (ts === 'flota') navigateToView?.('flota');
      else navigateToView?.('clima', { otId: ot.id });
    },
    onDetail: (ot, shell) => {
      openDrawer(ot, shell);
    },
  });
  kanbanSetActive = setActiveShell;

  mainCol.append(boardEl);
  asideCol.append(jarvisPanel.element);
  workspace.append(mainCol, asideCol);

  const body = el('hnf-cc__body');
  body.style.flexDirection = 'column';
  body.append(workspace);

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

  let selectedShell = null;
  let currentOt = null;
  let escHandler = null;

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
    kanbanSetActive(null);
    jarvisPanel.setOt(null);
    selectedShell = null;
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

  function openDrawer(ot, shell) {
    currentOt = ot;
    selectedShell = shell;
    idEl.textContent = String(ot.id || '');
    sub.textContent = String(ot.cliente || '').trim() || '—';
    jarvisPanel.setOt(ot);
    kanbanSetActive(shell);
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
  }

  closeBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  drawer.append(drawerHandle, dHead, drawerSummary, actRow, jarvisStrip, tabsRow, tabBodies, foot);

  body.append(backdrop, drawer);

  section.append(header, alerts, kpiRow, body);

  return section;
}
