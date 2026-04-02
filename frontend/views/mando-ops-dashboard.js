import '../styles/hnf-ops-mando.css';
import { applyJarvisRulesToNewOt } from '../domain/hnf-ot-jarvis-rules.js';
import { filtrarOtsPorRolBackend } from '../domain/hnf-operativa-reglas.js';
import {
  buildRecentActivityLines,
  computeKpiDeltas,
  computeMandoOpsDashboardMetrics,
  pushActivasTrendPoint,
  readKpiSnapshot,
  systemSemaphoreState,
  writeKpiSnapshot,
} from '../domain/mando-ops-dashboard-data.js';
import { buildMandoJarvisAlerts } from '../domain/mando-ops-jarvis-alerts.js';
import { simpleLaneToCommitLane } from '../domain/ot-simple-kanban-lanes.js';
import { getAllOTs, persistEstadoOperativo } from '../domain/repositories/operations-repository.js';
import { getSessionBackendRole } from '../config/session-bridge.js';
import { createSimpleKanbanBoard } from '../components/mando/simple-kanban.js';

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function deltaEl(d, invertGood = false) {
  const span = el('hnf-ops-kpi-card__delta');
  if (d.up === null) {
    span.textContent = d.text;
    return span;
  }
  const good = invertGood ? !d.up : d.up;
  span.textContent = `${d.up ? '↑' : '↓'} ${d.text}`;
  span.classList.add(good ? 'hnf-ops-kpi-card__delta--down' : 'hnf-ops-kpi-card__delta--up');
  return span;
}

function deltaElGold(d) {
  const span = el('hnf-ops-kpi-card__delta');
  if (d.up === null) {
    span.textContent = d.text;
    return span;
  }
  span.textContent = `${d.up ? '↑' : '↓'} ${d.text}`;
  span.classList.add('hnf-ops-kpi-card__delta--gold');
  return span;
}

/**
 * Dashboard Mando — KPIs, actividad, estado sistema, alertas Jarvis, pipeline.
 */
export function mandoOpsDashboardView(props) {
  const { data, reloadApp, navigateToView, actions, mandoFeedback, integrationStatus } = props || {};
  const otsEnvelope = data?.ots;
  const otsRaw = Array.isArray(otsEnvelope?.data)
    ? otsEnvelope.data
    : Array.isArray(otsEnvelope)
      ? otsEnvelope
      : [];
  const br = getSessionBackendRole() || 'admin';
  const ots = getAllOTs(filtrarOtsPorRolBackend(otsRaw, br));
  const veh = data?.maestroVehiculos ?? [];

  const metrics = computeMandoOpsDashboardMetrics(ots, veh);
  const prev = readKpiSnapshot();
  const curSnap = {
    activas: metrics.activas,
    slaPct: metrics.slaPct,
    flotaPct: metrics.flotaPct ?? 0,
    alertasCriticas: metrics.alertasCriticas,
  };
  const deltas = computeKpiDeltas(curSnap, prev);
  const trendArr = pushActivasTrendPoint(metrics.activas);
  const activityLines = buildRecentActivityLines(ots, data?.operationalEvents, 8);
  const jarvisAlerts = buildMandoJarvisAlerts(ots, 3);
  const sem = systemSemaphoreState(integrationStatus, metrics.alertasCriticas);

  writeKpiSnapshot(curSnap);

  const section = el('hnf-ops-mando', 'section');
  section.setAttribute('aria-label', 'Mando operativo');

  if (mandoFeedback?.message) {
    const ban = el(
      `hnf-ops-mp-banner hnf-ops-mp-banner--${mandoFeedback.type === 'error' ? 'error' : 'success'}`
    );
    ban.setAttribute('role', 'status');
    const tx = document.createElement('span');
    tx.textContent = mandoFeedback.message;
    const dis = el('hnf-ops-mp-banner__dismiss', 'button');
    dis.type = 'button';
    dis.textContent = 'Cerrar';
    dis.addEventListener('click', () => actions?.clearMandoFeedback?.());
    ban.append(tx, dis);
    section.append(ban);
  }

  const kpiRow = el('hnf-ops-kpi-row');
  const mkKpi = (label, valueText, deltaNode) => {
    const c = el('hnf-ops-kpi-card');
    const v = el('hnf-ops-kpi-card__value');
    v.textContent = valueText;
    const k = el('hnf-ops-kpi-card__label');
    k.textContent = label;
    c.append(v, k);
    if (deltaNode) c.append(deltaNode);
    return c;
  };

  kpiRow.append(
    mkKpi('OTs activas', String(metrics.activas), deltaEl(deltas.activas, false)),
    mkKpi('SLA cumplimiento', `${metrics.slaPct}%`, deltaElGold(deltas.sla)),
    mkKpi(
      'Flota operativa',
      metrics.flotaPct == null ? '—' : `${metrics.flotaPct}%`,
      deltaEl(deltas.flota, false)
    ),
    mkKpi('Alertas críticas', String(metrics.alertasCriticas), deltaEl(deltas.alertas, true))
  );
  section.append(kpiRow);

  const split = el('hnf-ops-split');
  const actPanel = el('hnf-ops-panel');
  const actHead = el('hnf-ops-panel__head');
  actHead.textContent = 'Actividad reciente';
  actPanel.append(actHead);
  const actBody = el('hnf-ops-activity');
  if (!activityLines.length) {
    const empty = el('hnf-ops-activity__txt');
    empty.textContent = 'Sin eventos en este corte.';
    actBody.append(empty);
  } else {
    for (const line of activityLines) {
      const row = el('hnf-ops-activity__row');
      const at = el('hnf-ops-activity__at', 'span');
      at.textContent = line.at || '—';
      const tx = el('hnf-ops-activity__txt', 'span');
      tx.textContent = line.text;
      row.append(at, tx);
      actBody.append(row);
    }
  }
  actPanel.append(actBody);

  const sysPanel = el('hnf-ops-panel');
  const sysHead = el('hnf-ops-panel__head');
  sysHead.textContent = 'Estado del sistema';
  sysPanel.append(sysHead);
  const semRow = el('hnf-ops-sys__sem');
  const light = el(
    `hnf-ops-sys__light hnf-ops-sys__light--${sem === 'green' ? 'green' : sem === 'yellow' ? 'yellow' : 'red'}`
  );
  const lab = el('hnf-ops-sys__label');
  lab.textContent =
    sem === 'green'
      ? 'Operación nominal'
      : sem === 'yellow'
        ? 'Atención requerida'
        : 'Intervención prioritaria';
  semRow.append(light, lab);
  sysPanel.append(semRow);
  const trendWrap = el('hnf-ops-trend');
  const pts = trendArr.length ? trendArr : [metrics.activas];
  const maxT = Math.max(1, ...pts);
  for (const p of pts) {
    const b = el('hnf-ops-trend__bar');
    b.style.height = `${Math.max(8, (p / maxT) * 100)}%`;
    b.title = `Activas: ${p}`;
    trendWrap.append(b);
  }
  sysPanel.append(trendWrap);
  split.append(actPanel, sysPanel);
  section.append(split);

  const jarHead = el('hnf-ops-sec-title');
  jarHead.textContent = 'Alertas Jarvis';
  section.append(jarHead);
  const alertsBox = el('hnf-ops-alerts');
  if (!jarvisAlerts.length) {
    const p = el('hnf-ops-panel');
    p.textContent = 'Sin alertas prioritarias en este corte.';
    alertsBox.append(p);
  } else {
    for (const a of jarvisAlerts) {
      const row = el(`hnf-ops-alert hnf-ops-alert--${a.severity === 'warn' ? 'warn' : 'critical'}`);
      const msg = el('hnf-ops-alert__msg', 'p');
      msg.textContent = a.message;
      const btn = el('hnf-ops-btn hnf-ops-btn--primary', 'button');
      btn.type = 'button';
      btn.textContent = 'Ver';
      btn.addEventListener('click', () => {
        const t = String(a.ot?.tipoServicio || '').toLowerCase();
        if (typeof actions?.selectOT === 'function') actions.selectOT(a.ot.id);
        if (t === 'flota') navigateToView?.('flota');
        else navigateToView?.('clima', { otId: a.ot.id });
      });
      row.append(msg, btn);
      alertsBox.append(row);
    }
  }
  section.append(alertsBox);

  const tb = el('hnf-ops-toolbar');
  const bNew = el('hnf-ops-btn hnf-ops-btn--primary', 'button');
  bNew.type = 'button';
  bNew.textContent = 'Nueva OT';
  const bSync = el('hnf-ops-btn', 'button');
  bSync.type = 'button';
  bSync.textContent = 'Sincronizar';
  bSync.addEventListener('click', () => {
    if (typeof reloadApp === 'function') void reloadApp();
  });
  const bOt = el('hnf-ops-btn', 'button');
  bOt.type = 'button';
  bOt.textContent = 'Ver todas las OT';
  bOt.addEventListener('click', () => navigateToView?.('gestion-ot'));
  tb.append(bNew, bSync, bOt);
  section.append(tb);

  const quickSheet = el('hnf-ops-mp-quick');
  quickSheet.hidden = true;
  let quickStep = 0;
  const qCliente = Object.assign(document.createElement('input'), {
    type: 'text',
    placeholder: 'Cliente',
    autocomplete: 'off',
  });
  const qTipo = document.createElement('select');
  qTipo.innerHTML =
    '<option value="clima">Clima</option><option value="flota">Flota</option>';
  const qPri = document.createElement('select');
  qPri.innerHTML = '<option value="media">Media</option><option value="alta">Alta</option><option value="baja">Baja</option>';
  const qDir = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Dirección' });
  const qCom = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Comuna' });
  const qCont = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Contacto' });
  const qTel = Object.assign(document.createElement('input'), { type: 'tel', placeholder: 'Teléfono' });
  const qFecha = Object.assign(document.createElement('input'), { type: 'date' });
  const qHora = Object.assign(document.createElement('input'), { type: 'time' });
  const qSub = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Subtipo trabajo' });
  try {
    const t = new Date();
    qFecha.value = t.toISOString().slice(0, 10);
    qHora.value = '09:00';
  } catch {
    /* ignore */
  }
  const qDots = el('hnf-ops-mp-quick__steps');
  const d0 = el('hnf-ops-mp-quick__step-dot');
  const d1 = el('hnf-ops-mp-quick__step-dot');
  const d2 = el('hnf-ops-mp-quick__step-dot');
  qDots.append(d0, d1, d2);
  const qGrid = el('hnf-ops-mp-quick__grid');
  const qNav = el('', 'div');
  qNav.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;';
  const qPrev = el('hnf-ops-btn', 'button');
  qPrev.type = 'button';
  qPrev.textContent = 'Anterior';
  const qNext = el('hnf-ops-btn hnf-ops-btn--primary', 'button');
  qNext.type = 'button';
  qNext.textContent = 'Siguiente';
  const qOk = el('hnf-ops-btn hnf-ops-btn--primary', 'button');
  qOk.type = 'button';
  qOk.textContent = 'Crear en servidor';
  const qCan = el('hnf-ops-btn', 'button');
  qCan.type = 'button';
  qCan.textContent = 'Cancelar';
  const qSt = el('', 'p');
  qSt.style.cssText = 'font-size:0.75rem;color:var(--ops-muted);margin-top:8px;';

  const paintQ = () => {
    d0.classList.toggle('hnf-ops-mp-quick__step-dot--on', quickStep >= 0);
    d1.classList.toggle('hnf-ops-mp-quick__step-dot--on', quickStep >= 1);
    d2.classList.toggle('hnf-ops-mp-quick__step-dot--on', quickStep >= 2);
    qGrid.replaceChildren();
    qPrev.hidden = quickStep <= 0;
    qNext.hidden = quickStep >= 2;
    qOk.hidden = quickStep < 2;
    const L = (txt, node) => {
      const lb = document.createElement('label');
      lb.append(txt, node);
      return lb;
    };
    if (quickStep === 0) qGrid.append(L('Cliente', qCliente), L('Servicio', qTipo), L('Prioridad', qPri));
    else if (quickStep === 1) {
      qGrid.append(
        L('Dirección', qDir),
        L('Comuna', qCom),
        L('Contacto', qCont),
        L('Teléfono', qTel),
        L('Fecha', qFecha),
        L('Hora', qHora),
        L('Subtipo', qSub)
      );
    } else {
      const p = document.createElement('p');
      p.style.color = 'var(--ops-muted)';
      p.style.fontSize = '0.85rem';
      p.style.gridColumn = '1 / -1';
      p.textContent = `Confirmar: ${qCliente.value.trim() || '—'} · ${qTipo.value} · ${qDir.value}, ${qCom.value}`;
      qGrid.append(p);
    }
  };

  qPrev.addEventListener('click', () => {
    quickStep = Math.max(0, quickStep - 1);
    paintQ();
  });
  qNext.addEventListener('click', () => {
    if (quickStep === 0 && !qCliente.value.trim()) {
      qSt.textContent = 'Indicá cliente.';
      return;
    }
    if (quickStep === 1) {
      if (!qDir.value.trim() || !qCom.value.trim() || !qCont.value.trim() || !qTel.value.trim()) {
        qSt.textContent = 'Completá dirección, comuna, contacto y teléfono.';
        return;
      }
      if (!qSub.value.trim()) {
        qSt.textContent = 'Indicá subtipo.';
        return;
      }
    }
    qSt.textContent = '';
    quickStep = Math.min(2, quickStep + 1);
    paintQ();
  });
  qCan.addEventListener('click', () => {
    quickSheet.hidden = true;
    quickStep = 0;
    paintQ();
  });
  qOk.addEventListener('click', async () => {
    const tipo = String(qTipo.value || 'clima').toLowerCase();
    const jarvis = applyJarvisRulesToNewOt({
      text: qSub.value,
      area: tipo === 'flota' ? 'flota' : 'clima',
      cliente: qCliente.value,
    });
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
      tecnicoAsignado: jarvis.responsable,
      observaciones: `Alta Mando · ${jarvis.responsable}`,
      equipos: [],
    };
    qOk.disabled = true;
    const r = await actions?.createOT?.(payload);
    qOk.disabled = false;
    if (r?.ok) {
      actions?.setMandoFeedback?.({ type: 'success', message: `OT ${r.id} creada.` });
      quickSheet.hidden = true;
      quickStep = 0;
      paintQ();
      if (typeof reloadApp === 'function') void reloadApp();
    } else {
      qSt.textContent = r?.message || 'No se pudo crear.';
    }
  });
  qNav.append(qCan, qPrev, qNext, qOk);
  const qLead = document.createElement('p');
  qLead.style.cssText = 'font-weight:600;margin:0 0 8px;font-size:0.875rem;';
  qLead.textContent = 'Nueva OT';
  quickSheet.append(qLead, qDots, qGrid, qNav, qSt);
  paintQ();
  bNew.addEventListener('click', () => {
    quickSheet.hidden = !quickSheet.hidden;
    if (!quickSheet.hidden) {
      quickStep = 0;
      paintQ();
    }
  });
  section.append(quickSheet);

  const pipeTitle = el('hnf-ops-sec-title');
  pipeTitle.textContent = 'Pipeline operativo';
  section.append(pipeTitle);

  const { element: boardEl } = createSimpleKanbanBoard({
    ots,
    onOpenOt: (ot) => {
      const t = String(ot.tipoServicio || '').toLowerCase();
      if (typeof actions?.selectOT === 'function') actions.selectOT(ot.id);
      if (t === 'flota') navigateToView?.('flota');
      else navigateToView?.('clima', { otId: ot.id });
    },
    onDropOnLane: (ot, simpleLaneId) => {
      void (async () => {
        const lane = simpleLaneToCommitLane(simpleLaneId);
        if (typeof actions?.commitKanbanLane === 'function') {
          await actions.commitKanbanLane(ot, lane);
          return;
        }
        const r = persistEstadoOperativo(ot, lane);
        if (!r.ok) window.alert(r.error || 'No se pudo mover');
        else if (typeof reloadApp === 'function') void reloadApp();
      })();
    },
  });
  section.append(boardEl);

  return section;
}
