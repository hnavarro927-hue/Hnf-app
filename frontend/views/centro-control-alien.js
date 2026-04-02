import '../styles/centro-control-alien.css';
import '../styles/hnf-mando-premium.css';
import '../styles/hnf-operational-kanban.css';
import { applyJarvisRulesToNewOt } from '../domain/hnf-ot-jarvis-rules.js';
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
import { getEffectiveEstadoOperativo, validTargetEstados } from '../domain/hnf-ot-state-engine.js';
import { getAllOTs, persistEstadoOperativo } from '../domain/repositories/operations-repository.js';
import { buildOperationalKpisFromMergedList } from '../domain/repositories/analytics-builder.js';
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
  const {
    data,
    reloadApp,
    navigateToView,
    actions,
    integrationStatus,
    lastDataRefreshAt,
    authLabel,
    mandoFeedback,
  } = props || {};
  const otsEnvelope = data?.ots;
  const otsRaw = Array.isArray(otsEnvelope?.data)
    ? otsEnvelope.data
    : Array.isArray(otsEnvelope)
      ? otsEnvelope
      : [];
  const br = getSessionBackendRole() || 'admin';
  const ots = getAllOTs(filtrarOtsPorRolBackend(otsRaw, br));

  const section = el(
    'hnf-cc hnf-cc-mando hnf-cck-surface hnf-op-shell hnf-op-view hnf-op-view--mando hnf-mando-premium',
    'section'
  );
  section.setAttribute('aria-label', 'Centro de control operativo');

  if (mandoFeedback?.message) {
    const ban = el(
      `hnf-mp-banner hnf-mp-banner--${mandoFeedback.type === 'error' ? 'error' : 'success'}`
    );
    ban.setAttribute('role', 'status');
    const tx = document.createElement('span');
    tx.textContent = mandoFeedback.message;
    const dis = el('hnf-mp-banner__dismiss', 'button');
    dis.type = 'button';
    dis.textContent = 'Cerrar';
    dis.addEventListener('click', () => actions?.clearMandoFeedback?.());
    ban.append(tx, dis);
    section.append(ban);
  }

  const jSig = buildJarvisGerencialSignals(ots);
  const opKpi = buildOperationalKpisFromMergedList(ots);

  const command = el('hnf-cc-mando__command hnf-v2-holo-command');
  const cmdLeft = el('');
  const hTitle = document.createElement('h1');
  hTitle.textContent = 'Panel operativo · Pipeline HNF';
  const hSub = document.createElement('p');
  hSub.textContent =
    'Kanban en vivo con persistencia en servidor. Arrastrá tarjetas entre columnas. Detalle en panel lateral (sin modales largos).';
  const headAct = el('hnf-cc-mando__actions hnf-v2-holo-actions');
  const mkHeadBtn = (label, primary, fn) => {
    const b = el(`hnf-op-btn${primary ? ' hnf-op-btn--primary' : ''}`, 'button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  const quickSheet = el('hnf-mp-quick');
  quickSheet.hidden = true;
  let quickStep = 0;
  const qCliente = Object.assign(document.createElement('input'), {
    type: 'text',
    placeholder: 'Razón social o nombre',
    autocomplete: 'off',
  });
  const qTipo = document.createElement('select');
  qTipo.innerHTML =
    '<option value="clima">Clima → responsable Romina</option><option value="flota">Flota → responsable Gery</option>';
  const qPri = document.createElement('select');
  qPri.innerHTML =
    '<option value="media">Prioridad media</option><option value="alta">Alta</option><option value="baja">Baja</option>';
  const qDir = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Dirección' });
  const qCom = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Comuna' });
  const qCont = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Contacto en terreno' });
  const qTel = Object.assign(document.createElement('input'), { type: 'tel', placeholder: '+56…' });
  const qFecha = Object.assign(document.createElement('input'), { type: 'date' });
  const qHora = Object.assign(document.createElement('input'), { type: 'time' });
  const qSub = Object.assign(document.createElement('input'), {
    type: 'text',
    placeholder: 'Subtipo / trabajo (ej. Mantención)',
  });
  try {
    const t = new Date();
    qFecha.value = t.toISOString().slice(0, 10);
    qHora.value = '09:00';
  } catch {
    /* ignore */
  }
  const qStepsDots = el('hnf-mp-quick__steps');
  const qDot = () => el('hnf-mp-quick__step-dot');
  const d0 = qDot();
  const d1 = qDot();
  const d2 = qDot();
  qStepsDots.append(d0, d1, d2);
  const qGrid = el('hnf-mp-quick__grid');
  const qNav = el('', 'div');
  qNav.style.display = 'flex';
  qNav.style.gap = '8px';
  qNav.style.flexWrap = 'wrap';
  qNav.style.marginTop = '8px';
  const qBtnPrev = el('hnf-op-btn', 'button');
  qBtnPrev.type = 'button';
  qBtnPrev.textContent = 'Anterior';
  const qBtnNext = el('hnf-op-btn hnf-op-btn--primary', 'button');
  qBtnNext.type = 'button';
  qBtnNext.textContent = 'Siguiente';
  const qBtnCreate = el('hnf-op-btn hnf-op-btn--primary', 'button');
  qBtnCreate.type = 'button';
  qBtnCreate.textContent = 'Confirmar y crear en servidor';
  const qBtnCancel = el('hnf-op-btn', 'button');
  qBtnCancel.type = 'button';
  qBtnCancel.textContent = 'Cancelar';
  const qStatus = el('', 'p');
  qStatus.style.fontSize = '0.75rem';
  qStatus.style.color = '#a1a1aa';
  qStatus.style.marginTop = '8px';

  const paintQuick = () => {
    d0.classList.toggle('hnf-mp-quick__step-dot--on', quickStep >= 0);
    d1.classList.toggle('hnf-mp-quick__step-dot--on', quickStep >= 1);
    d2.classList.toggle('hnf-mp-quick__step-dot--on', quickStep >= 2);
    qGrid.replaceChildren();
    qBtnPrev.hidden = quickStep <= 0;
    qBtnNext.hidden = quickStep >= 2;
    qBtnCreate.hidden = quickStep < 2;
    if (quickStep === 0) {
      const L = (txt, node) => {
        const lb = document.createElement('label');
        lb.append(txt, node);
        return lb;
      };
      qGrid.append(L('Cliente', qCliente), L('Servicio', qTipo), L('Prioridad', qPri));
    } else if (quickStep === 1) {
      const L = (txt, node) => {
        const lb = document.createElement('label');
        lb.append(txt, node);
        return lb;
      };
      qGrid.append(
        L('Dirección', qDir),
        L('Comuna', qCom),
        L('Contacto', qCont),
        L('Teléfono', qTel),
        L('Fecha visita', qFecha),
        L('Hora', qHora),
        L('Subtipo', qSub)
      );
    } else {
      const p = document.createElement('p');
      p.style.gridColumn = '1 / -1';
      p.style.color = '#e4e4e7';
      p.style.fontSize = '0.85rem';
      p.textContent = `Confirmá: ${qCliente.value.trim() || '—'} · ${qTipo.value} · ${qDir.value.trim()}, ${qCom.value.trim()} · ${qFecha.value} ${qHora.value}`;
      qGrid.append(p);
    }
  };

  qBtnPrev.addEventListener('click', () => {
    quickStep = Math.max(0, quickStep - 1);
    paintQuick();
  });
  qBtnNext.addEventListener('click', () => {
    if (quickStep === 0 && !qCliente.value.trim()) {
      qStatus.textContent = 'Completá el cliente.';
      return;
    }
    if (quickStep === 1) {
      if (!qDir.value.trim() || !qCom.value.trim() || !qCont.value.trim() || !qTel.value.trim()) {
        qStatus.textContent = 'Dirección, comuna, contacto y teléfono son obligatorios.';
        return;
      }
      if (!qSub.value.trim()) {
        qStatus.textContent = 'Indicá el subtipo de trabajo.';
        return;
      }
    }
    qStatus.textContent = '';
    quickStep = Math.min(2, quickStep + 1);
    paintQuick();
  });
  qBtnCancel.addEventListener('click', () => {
    quickSheet.hidden = true;
    quickStep = 0;
    paintQuick();
  });
  qBtnCreate.addEventListener('click', async () => {
    const tipo = String(qTipo.value || 'clima').toLowerCase();
    const jarvis = applyJarvisRulesToNewOt({
      text: qSub.value,
      area: tipo === 'flota' ? 'flota' : 'clima',
      cliente: qCliente.value,
    });
    const tech = jarvis.responsable;
    const payload = {
      cliente: qCliente.value.trim(),
      direccion: qDir.value.trim(),
      comuna: qCom.value.trim(),
      contactoTerreno: qCont.value.trim(),
      telefonoContacto: qTel.value.trim(),
      tipoServicio: tipo,
      subtipoServicio: qSub.value.trim(),
      fecha: qFecha.value,
      hora: qHora.value || '09:00',
      origenSolicitud: 'cliente_directo',
      origenPedido: 'manual',
      prioridadOperativa: qPri.value || jarvis.prioridadOperativa,
      operationMode: 'manual',
      tecnicoAsignado: tech,
      observaciones: `Alta rápida Mando · Jarvis → ${tech} · P ${qPri.value || jarvis.prioridadOperativa}`,
      equipos: [],
    };
    qBtnCreate.disabled = true;
    qStatus.textContent = 'Creando…';
    const r = await actions?.createOT?.(payload);
    qBtnCreate.disabled = false;
    if (r?.ok) {
      actions?.setMandoFeedback?.({
        type: 'success',
        message: `OT ${r.id} creada. Aparece en columna Ingreso tras sincronizar.`,
      });
      qStatus.textContent = `OT ${r.id} creada.`;
      quickSheet.hidden = true;
      quickStep = 0;
      paintQuick();
      if (typeof reloadApp === 'function') void reloadApp();
    } else {
      qStatus.textContent = r?.message || 'No se pudo crear. Revisá sesión y datos.';
    }
  });
  qNav.append(qBtnCancel, qBtnPrev, qBtnNext, qBtnCreate);
  const qLead = document.createElement('p');
  qLead.style.fontWeight = '600';
  qLead.style.margin = '0 0 8px';
  qLead.style.color = '#fafafa';
  qLead.textContent = 'Nueva OT en 3 pasos';
  quickSheet.append(qLead, qStepsDots, qGrid, qNav, qStatus);
  paintQuick();

  headAct.append(
    mkHeadBtn('Nueva OT', true, () => {
      quickSheet.hidden = !quickSheet.hidden;
      if (!quickSheet.hidden) {
        quickStep = 0;
        paintQuick();
      }
    }),
    mkHeadBtn('Jarvis HQ', false, () => navigateToView?.('jarvis')),
    mkHeadBtn('Ingesta', false, () => navigateToView?.('ingreso-operativo')),
    mkHeadBtn('Actualizar', false, () => {
      if (typeof reloadApp === 'function') void reloadApp();
    })
  );
  cmdLeft.append(hTitle, hSub, quickSheet);
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

  const hoursSinceIso = (iso) => {
    const t = new Date(String(iso || '')).getTime();
    if (!Number.isFinite(t)) return null;
    return (Date.now() - t) / 3600000;
  };
  let detenidas = 0;
  for (const o of ots) {
    const st = getEffectiveEstadoOperativo(o);
    const h = hoursSinceIso(o.updatedAt || o.creadoEn || o.createdAt);
    if (st === 'ingreso' && h != null && h > 24) detenidas += 1;
    else if (st === 'en_proceso' && h != null && h > 48) detenidas += 1;
  }
  const margenSum = ots.reduce((s, o) => s + (Number(o.utilidad) || 0), 0);
  let lynN = 0;
  let lynOk = 0;
  for (const o of ots) {
    const l = String(o.aprobacionLynEstado || '').toLowerCase();
    if (l === 'aprobado_lyn' || l === 'rechazado_lyn') {
      lynN += 1;
      if (l === 'aprobado_lyn') lynOk += 1;
    }
  }
  const tasaLyn = lynN ? `${Math.round((100 * lynOk) / lynN)}%` : '—';

  const kpiDash = el('hnf-mp-kpi-dash');
  const mpTile = (label, value, accent) => {
    const t = el(`hnf-mp-kpi-tile${accent ? ' hnf-mp-kpi-tile--accent' : ''}`);
    const v = el('hnf-mp-kpi-tile__v');
    v.textContent = value;
    const k = el('hnf-mp-kpi-tile__k');
    k.textContent = label;
    t.append(v, k);
    return t;
  };
  kpiDash.append(
    mpTile('OT en riesgo (heurística)', String(opKpi.riesgoOperativo || 0), true),
    mpTile('OT detenidas (SLA visual)', String(detenidas), detenidas > 0),
    mpTile('Margen Σ utilidad CLP', margenSum ? String(Math.round(margenSum).toLocaleString('es-CL')) : '0'),
    mpTile('Tasa aprobación Lyn', tasaLyn),
    mpTile('OT en tablero', String(ots.length))
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
      void (async () => {
        if (typeof actions?.commitKanbanLane === 'function') {
          const r = await actions.commitKanbanLane(ot, laneId);
          if (!r?.ok) return;
          return;
        }
        const r = persistEstadoOperativo(ot, laneId);
        if (!r.ok) window.alert(r.error || 'No se pudo mover de columna');
        else if (typeof reloadApp === 'function') void reloadApp();
      })();
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

  const primaryActRow = el('hnf-mp-drawer-actions-primary');
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
    primaryActRow.replaceChildren();
    const t = String(ot?.tipoServicio || '').toLowerCase();
    const mk = (label, fn) => {
      const b = el('hnf-cc__act-btn', 'button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    const mkPri = (label, fn, variant) => {
      const b = el(
        `hnf-cc__act-btn${variant === 'danger' ? ' hnf-cc__act-btn--danger' : ''}${variant === 'ok' ? ' hnf-cc__act-btn--ok' : ''}`,
        'button'
      );
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    const mapQuery = encodeURIComponent(
      `${String(ot?.direccion || '').trim()} ${String(ot?.comuna || '').trim()}`.trim() || 'Chile'
    );
    primaryActRow.append(
      mkPri('Aprobar', () => void actions?.applyLynAccionOnOt?.(ot.id, 'aprobar'), 'ok'),
      mkPri('Rechazar', () => void actions?.applyLynAccionOnOt?.(ot.id, 'rechazar'), 'danger'),
      mkPri('Ver mapa', () => {
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
          '_blank',
          'noopener,noreferrer'
        );
      }),
      mkPri('Añadir nota', () => {
        const note = window.prompt('Nota (se agrega a observaciones de la OT):');
        if (note && String(note).trim()) {
          void actions?.mandoAppendObservacion?.(ot.id, String(note).trim(), ot.observaciones);
        }
      })
    );
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

  drawer.append(drawerHandle, dHead, drawerSummary, primaryActRow, actRow, jarvisStrip, tabsRow, tabBodies, foot);

  body.append(backdrop, drawer);

  section.append(command, execStrip, jarvisPresenceEl, alienFlow.element, kpiRow, kpiDash, body);

  return section;
}
