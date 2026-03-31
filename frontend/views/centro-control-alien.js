import '../styles/centro-control-alien.css';
import '../styles/hnf-operational-kanban.css';
import { createControlKanbanRegion } from '../components/control-center/ControlKanban.js';
import { createJarvisCorePanel } from '../components/control-center/JarvisCorePanel.js';
import { createJarvisExecutiveCopilotStrip } from '../components/jarvis-executive-copilot-strip.js';
import { createJarvisAlienFlow } from '../components/jarvis-alien-flow.js';
import { buildJarvisDecisionCard } from '../components/jarvis-decision-card.js';
import { createJarvisPresence, jarvisLineaModoAlien } from '../components/jarvis-presence.js';
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
import { buildJarvisGerencialSignals } from '../domain/jarvis-gerencial-signals.js';
import { getEffectiveEstadoOperativo, buildOtOperationalKpis, validTargetEstados } from '../domain/hnf-ot-state-engine.js';
import { getAllOTs, persistEstadoOperativo } from '../domain/ot-repository.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

const ALERTA_OPTS_CENTRO = HEURISTICA_OPERATIVA_V1;

function mountFlowEstadoPicker(ot, laneLabels, reloadApp) {
  const cur = getEffectiveEstadoOperativo(ot);
  const choices = validTargetEstados(cur).filter((x) => x !== cur);
  if (!choices.length) {
    window.alert(`Estado flujo: ${cur}. No hay paso adyacente disponible.`);
    return;
  }
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:120;display:flex;align-items:center;justify-content:center;padding:16px;';
  const card = document.createElement('div');
  card.style.cssText =
    'background:#0f172a;border:1px solid rgba(34,211,238,.35);border-radius:14px;padding:18px;max-width:360px;width:100%;';
  const t = document.createElement('p');
  t.style.cssText = 'margin:0 0 12px;font-size:14px;color:#e2e8f0;';
  t.textContent = `Cambiar estado del flujo OT (actual: ${cur})`;
  const sel = document.createElement('select');
  sel.style.cssText =
    'width:100%;padding:10px;margin-bottom:14px;border-radius:8px;background:#020617;color:#e2e8f0;border:1px solid #334155;';
  for (const c of choices) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = laneLabels[c] || c;
    sel.append(o);
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary-button';
  cancel.textContent = 'Cancelar';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'primary-button';
  ok.textContent = 'Aplicar';
  cancel.addEventListener('click', () => backdrop.remove());
  ok.addEventListener('click', () => {
    const r = persistEstadoOperativo(ot, sel.value);
    backdrop.remove();
    if (!r.ok) window.alert(r.error || 'No se pudo aplicar');
    else if (typeof reloadApp === 'function') void reloadApp();
  });
  row.append(cancel, ok);
  card.append(t, sel, row);
  backdrop.append(card);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.body.append(backdrop);
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
      ['Estado flujo', getEffectiveEstadoOperativo(ot)],
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

function kpiMetric(label, value, variantClass = '') {
  const d = el(`hnf-v2-metric${variantClass ? ` ${variantClass}` : ''}`);
  const v = el('hnf-v2-metric__value');
  v.textContent = value;
  const k = el('hnf-v2-metric__label');
  k.textContent = label;
  d.append(v, k);
  return d;
}

/**
 * Centro de control: layout operativo + KanbanBoard + JarvisPanel + drawer detalle.
 * Datos: GET /ots (vía props.data).
 */
export function centroControlAlienView(props) {
  const { data, reloadApp, navigateToView, actions, integrationStatus, lastDataRefreshAt, authLabel } =
    props || {};
  const otsEnvelope = data?.ots;
  const otsRaw = Array.isArray(otsEnvelope?.data)
    ? otsEnvelope.data
    : Array.isArray(otsEnvelope)
      ? otsEnvelope
      : [];
  const br = getSessionBackendRole() || 'admin';
  const ots = getAllOTs(filtrarOtsPorRolBackend(otsRaw, br));

  const section = el(
    'hnf-cc hnf-cc-mando hnf-cck-surface hnf-op-shell hnf-op-view hnf-op-view--mando',
    'section'
  );
  section.setAttribute('aria-label', 'Centro de control operativo');

  const jSig = buildJarvisGerencialSignals(ots);
  const opKpi = buildOtOperationalKpis(ots);

  const command = el('hnf-cc-mando__command hnf-v2-holo-command');
  const cmdLeft = el('');
  const hTitle = document.createElement('h1');
  hTitle.textContent = 'Operación HNF · Mando';
  const hSub = document.createElement('p');
  hSub.textContent = 'Kanban como superficie principal · núcleo Jarvis en el costado · un solo cockpit.';
  cmdLeft.append(hTitle, hSub);
  const headAct = el('hnf-cc-mando__actions hnf-v2-holo-actions');
  const mkHeadBtn = (label, primary, fn) => {
    const b = el(`hnf-op-btn${primary ? ' hnf-op-btn--primary' : ''}`, 'button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  headAct.append(
    mkHeadBtn('Jarvis HQ', false, () => navigateToView?.('jarvis')),
    mkHeadBtn('Ingesta', false, () => navigateToView?.('ingreso-operativo')),
    mkHeadBtn('Actualizar', true, () => {
      if (typeof reloadApp === 'function') void reloadApp();
    })
  );
  command.append(cmdLeft, headAct);

  const execStrip = createJarvisExecutiveCopilotStrip({
    authLabel,
    integrationStatus,
    viewData: data,
    lastDataRefreshAt,
  });

  const jarvisPresenceEl = createJarvisPresence({
    linea: jarvisLineaModoAlien(integrationStatus),
    metrics: {
      nRiesgo: jSig.nRiesgo,
      nUrgentes: jSig.nUrgentes,
      nPendAprobacion: jSig.nPendAprobacion,
    },
    suggestion: jSig.suggestion,
    variant: 'alien-bar',
    brandSubtitle: 'Jarvis | Integridad Operativa HNF',
  });

  const alienFlow = createJarvisAlienFlow();

  const kpiRow = el('hnf-v2-metric-row');
  const nRiesgo = opKpi.riesgoOperativo || 0;
  const topResp = Object.entries(opKpi.byResponsable || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)[0];
  kpiRow.append(
    kpiMetric('OT activas', String(opKpi.activas)),
    kpiMetric('Riesgo operativo', String(opKpi.riesgoOperativo), nRiesgo > 0 ? 'hnf-v2-metric--alert' : ''),
    kpiMetric('Prioridad alta', String(opKpi.prioridadAlta)),
    kpiMetric('Carga top responsable', topResp ? `${topResp[1]} · ${topResp[0]}` : '—')
  );

  const workspace = el('hnf-cc-mando__workspace');
  const mainCol = el('hnf-cc-mando__workspace-main');
  const asideCol = el('hnf-cc-mando__workspace-aside');

  const jarvisCore = createJarvisCorePanel();

  let kanbanSetActive = () => {};

  const { element: boardEl, setActiveShell } = createKanbanBoard({
    ots,
    laneLabels: DEFAULT_KANBAN_LANE_LABELS,
    onSelectOt: (ot) => {
      jarvisCore.setOt(ot);
      alienFlow.setOt(ot);
    },
    onAssignTech: (ot) => {
      const ts = String(ot.tipoServicio || '').toLowerCase();
      if (ts === 'flota') navigateToView?.('bandeja-gery');
      else navigateToView?.('bandeja-romina');
    },
    onChangeState: (ot) => {
      mountFlowEstadoPicker(ot, DEFAULT_KANBAN_LANE_LABELS, reloadApp);
    },
    onDropOnLane: (ot, laneId) => {
      const r = persistEstadoOperativo(ot, laneId);
      if (!r.ok) window.alert(r.error || 'No se pudo mover de columna');
      else if (typeof reloadApp === 'function') void reloadApp();
    },
    onDetail: (ot, shell) => {
      openDrawer(ot, shell);
    },
  });
  kanbanSetActive = setActiveShell;

  mainCol.append(createControlKanbanRegion({ boardElement: boardEl }));
  asideCol.append(jarvisCore.element);
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
    jarvisCore.setOt(null);
    alienFlow.setOt(null);
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
    jarvisCore.setOt(ot);
    alienFlow.setOt(ot);
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

  section.append(command, execStrip, jarvisPresenceEl, alienFlow.element, kpiRow, body);

  return section;
}
