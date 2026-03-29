/**
 * Jarvis agente flotante — asistente persistente (overlay), sin rail lateral.
 * Sin intervalos: el contenido se actualiza solo cuando main.render() llama a update().
 */

import { formatAllCloseBlockersMessage, getEvidenceGaps, otCanClose } from '../utils/ot-evidence.js';
import { computeCommandCenterMetrics } from '../domain/hnf-command-center-metrics.js';
import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';

function findOt(data, id) {
  if (!id) return null;
  const list = data?.planOts ?? data?.ots?.data ?? [];
  if (!Array.isArray(list)) return null;
  return list.find((o) => o.id === id) || null;
}

function truncate(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function buildJarvisAgentBrief(ctx) {
  const {
    activeView = 'jarvis',
    data = {},
    integrationStatus = 'pendiente',
    selectedOTId = null,
  } = ctx;

  const adn = buildHnfAdnSnapshot(data);
  const metrics = computeCommandCenterMetrics(data, { hnfAdn: adn });
  const ot = activeView === 'clima' ? findOt(data, selectedOTId) : null;

  let statusLabel = 'Activo';
  if (integrationStatus === 'sin conexión') statusLabel = 'Sin conexión';
  else if (integrationStatus === 'cargando' || integrationStatus === 'pendiente') {
    statusLabel = 'Sincronizando';
  }

  let priorityLine = 'Operación estable en este corte.';
  if (metrics.otSinEvidenciaCompleta > 0) {
    priorityLine = `${metrics.otSinEvidenciaCompleta} OT sin evidencia completa · priorizar cierre limpio.`;
  } else if (metrics.otEnRiesgo > 0) {
    priorityLine = `${metrics.otEnRiesgo} OT en riesgo o atraso · revisión en Clima.`;
  } else if (metrics.solicitudesNuevasHoy > 0) {
    priorityLine = `${metrics.solicitudesNuevasHoy} solicitud(es) flota nuevas hoy.`;
  }

  let riskLine = 'Sin riesgo operativo destacado.';
  if (integrationStatus === 'sin conexión') {
    riskLine = 'Backend no alcanzable · datos pueden estar desactualizados.';
  } else if (metrics.otEnRiesgo > 0) {
    riskLine = 'Atraso o criticidad en órdenes abiertas.';
  } else if (metrics.otSinEvidenciaCompleta > 0) {
    riskLine = 'Evidencia incompleta aumenta riesgo de retrabajo al informar.';
  }

  let actionLine = 'Revisá portada y módulos según prioridad.';
  if (activeView === 'clima' && ot) {
    const gaps = getEvidenceGaps(ot);
    if (!otCanClose(ot)) {
      actionLine = truncate(formatAllCloseBlockersMessage(ot), 140);
    } else if (gaps.length) {
      actionLine = `Completá ${gaps.length} hueco(s) de evidencia antes del informe.`;
    } else {
      actionLine = 'Evidencia OK en esta OT · podés avanzar a informe o cierre.';
    }
  } else if (activeView === 'flota') {
    actionLine =
      metrics.flotaPipelineAbiertas > 0
        ? `${metrics.flotaPipelineAbiertas} ítem(es) en pipeline flota · seguí trazabilidad.`
        : 'Flota sin cola crítica en este corte.';
  } else if (metrics.otSinEvidenciaCompleta > 0) {
    actionLine = 'Abrí Clima y cargá fotos antes / durante / después donde falten.';
  } else if (metrics.solicitudesNuevasHoy > 0) {
    actionLine = 'Revisá solicitudes del día en Flota.';
  }

  if (activeView === 'ingreso-operativo') {
    actionLine =
      'Completá teléfono o WhatsApp según el origen. Revisá «Información importante» en el resumen antes de guardar.';
    priorityLine = 'Ingreso guiado: datos completos hoy ahorran llamadas mañana.';
  }
  if (activeView === 'finanzas') {
    actionLine =
      'Los gastos nuevos quedan «Registrado»: la operación sigue. Acá aprobás, observás o rechazás con registro.';
    priorityLine = 'Finanzas: revisión posterior sin frenar a Romina, Gery ni técnicos.';
  }
  if (activeView === 'oportunidades') {
    actionLine = 'Comercial: oportunidades y OT con tipo Comercial para Lyn / Hernán.';
    priorityLine = 'Seguimiento de cartera y propuestas.';
  }

  const modHint =
    activeView === 'clima'
      ? ' · Módulo Clima (Romina).'
      : activeView === 'flota'
        ? ' · Módulo Flota (Gery).'
        : '';
  if (modHint && !priorityLine.includes('Módulo')) {
    priorityLine = `${priorityLine}${modHint}`;
  }

  let executeTarget = 'clima';
  let executeLabel = 'Ejecutar acción';
  if (metrics.otEnRiesgo > 0 || metrics.otSinEvidenciaCompleta > 0) {
    executeTarget = 'clima';
    executeLabel = 'Ir a OT crítica';
  } else if (metrics.solicitudesNuevasHoy > 0) {
    executeTarget = 'flota';
    executeLabel = 'Abrir Flota';
  } else {
    executeTarget = 'ingreso-operativo';
    executeLabel = 'Nuevo ingreso';
  }

  return {
    statusLabel,
    priorityLine,
    riskLine,
    actionLine,
    executeTarget,
    executeLabel,
    viewLabel: activeView,
  };
}

/**
 * @param {HTMLElement} [anchor]
 * @returns {{ update: Function, destroy: Function, root: HTMLElement }}
 */
export function mountHnfJarvisFloatingAgent(anchor = typeof document !== 'undefined' ? document.body : null) {
  if (!anchor) {
    return {
      update: () => {},
      destroy: () => {},
      root: null,
    };
  }

  const already = anchor.querySelector('[data-hnf-jarvis-agent-root]');
  if (already?.hnfJarvisFloatingAgentApi) {
    return already.hnfJarvisFloatingAgentApi;
  }

  const root = document.createElement('div');
  root.className = 'hnf-jarvis-agent-root';
  root.setAttribute('data-hnf-jarvis-agent-root', '');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'hnf-jarvis-agent-fab';
  fab.setAttribute('aria-label', 'Abrir asistente Jarvis');
  fab.setAttribute('aria-expanded', 'false');
  const orb = document.createElement('span');
  orb.className = 'hnf-jarvis-agent-fab__orb';
  orb.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('span');
  ring.className = 'hnf-jarvis-agent-fab__ring';
  ring.setAttribute('aria-hidden', 'true');
  fab.append(ring, orb);

  const backdrop = document.createElement('div');
  backdrop.className = 'hnf-jarvis-agent-backdrop';
  backdrop.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'hnf-jarvis-agent-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Asistente Jarvis');

  const panelHead = document.createElement('div');
  panelHead.className = 'hnf-jarvis-agent-panel__head';
  const panelTitle = document.createElement('span');
  panelTitle.className = 'hnf-jarvis-agent-panel__title';
  panelTitle.textContent = 'Jarvis';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'hnf-jarvis-agent-panel__close';
  closeBtn.setAttribute('aria-label', 'Cerrar asistente');
  closeBtn.textContent = '×';
  panelHead.append(panelTitle, closeBtn);

  const mkRow = (k, className) => {
    const row = document.createElement('div');
    row.className = 'hnf-jarvis-agent-panel__row';
    const kk = document.createElement('span');
    kk.className = 'hnf-jarvis-agent-panel__k';
    kk.textContent = k;
    const vv = document.createElement('p');
    vv.className = `hnf-jarvis-agent-panel__v ${className || ''}`;
    row.append(kk, vv);
    return { row, vv };
  };

  const r0 = mkRow('Estado', 'hnf-jarvis-agent-panel__v--status');
  const r1 = mkRow('Prioridad', '');
  const r2 = mkRow('Riesgo', '');
  const r3 = mkRow('Siguiente acción', '');

  const actions = document.createElement('div');
  actions.className = 'hnf-jarvis-agent-panel__actions';

  const btnClima = document.createElement('button');
  btnClima.type = 'button';
  btnClima.className = 'hnf-jarvis-agent-panel__btn hnf-jarvis-agent-panel__btn--primary';
  btnClima.textContent = 'Ir a Clima';

  const btnOt = document.createElement('button');
  btnOt.type = 'button';
  btnOt.className = 'hnf-jarvis-agent-panel__btn';
  btnOt.textContent = 'Revisar OT';

  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.className = 'hnf-jarvis-agent-panel__btn hnf-jarvis-agent-panel__btn--accent';
  btnExec.textContent = 'Ejecutar acción';

  actions.append(btnClima, btnOt, btnExec);

  panel.append(panelHead, r0.row, r1.row, r2.row, r3.row, actions);
  root.append(fab, backdrop, panel);
  anchor.append(root);

  const refs = {
    fab,
    backdrop,
    panel,
    closeBtn,
    vals: [r0.vv, r1.vv, r2.vv, r3.vv],
    btnClima,
    btnOt,
    btnExec,
  };

  let handlers = {
    navigateToView: null,
    intelNavigate: null,
    brief: null,
  };

  const setOpen = (open) => {
    fab.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    panel.hidden = !open;
    root.classList.toggle('hnf-jarvis-agent-root--open', open);
    if (open) {
      requestAnimationFrame(() => {
        btnClima.focus();
      });
    } else {
      fab.focus();
    }
  };

  const onFabClick = () => setOpen(panel.hidden);
  const onClose = () => setOpen(false);

  fab.addEventListener('click', onFabClick);
  closeBtn.addEventListener('click', onClose);
  backdrop.addEventListener('click', onClose);

  const onKey = (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      setOpen(false);
    }
  };
  document.addEventListener('keydown', onKey);

  btnClima.addEventListener('click', () => {
    handlers.navigateToView?.('clima');
    setOpen(false);
  });
  btnOt.addEventListener('click', () => {
    if (typeof handlers.intelNavigate === 'function') {
      handlers.intelNavigate({ view: 'clima' });
    } else {
      handlers.navigateToView?.('clima');
    }
    setOpen(false);
  });
  btnExec.addEventListener('click', () => {
    const t = handlers.brief?.executeTarget || 'clima';
    handlers.navigateToView?.(t);
    setOpen(false);
  });

  function update(ctx = {}) {
    handlers.navigateToView = ctx.navigateToView;
    handlers.intelNavigate = ctx.intelNavigate;
    const brief = buildJarvisAgentBrief(ctx);
    handlers.brief = brief;
    refs.vals[0].textContent = brief.statusLabel;
    refs.vals[1].textContent = brief.priorityLine;
    refs.vals[2].textContent = brief.riskLine;
    refs.vals[3].textContent = brief.actionLine;
    btnExec.textContent = brief.executeLabel;
    fab.classList.toggle('hnf-jarvis-agent-fab--warn', brief.statusLabel !== 'Activo');
  }

  function destroy() {
    document.removeEventListener('keydown', onKey);
    fab.removeEventListener('click', onFabClick);
    closeBtn.removeEventListener('click', onClose);
    backdrop.removeEventListener('click', onClose);
    root.remove();
  }

  const api = { update, destroy, root };
  root.hnfJarvisFloatingAgentApi = api;
  return api;
}
