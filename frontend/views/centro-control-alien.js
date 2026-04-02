import '../styles/centro-control-alien.css';
import '../styles/mando-centro-v2.css';
import { applyJarvisRulesToNewOt } from '../domain/hnf-ot-jarvis-rules.js';
import { buildJarvisDecisionCard } from '../components/jarvis-decision-card.js';
import { DEFAULT_KANBAN_LANE_LABELS } from '../components/kanban-board.js';
import { createSimpleKanbanBoard } from '../components/mando/simple-kanban.js';
import {
  createJarvisFloatingAssistant,
  createMandoHeaderV2,
  createMandoJarvisHero,
  createMandoKpisV2,
  createMandoQuickBar,
} from '../components/mando/mando-centro-v2.js';
import { simpleLaneToCommitLane, mapOtToSimpleLane } from '../domain/ot-simple-kanban-lanes.js';
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

/**
 * Centro de control HNF (Mando): Kanban 4 columnas, KPIs, Jarvis destacado, drawer detalle.
 * Datos: GET /ots (vía props.data).
 */
export function centroControlAlienView(props) {
  const { data, reloadApp, navigateToView, actions, integrationStatus, mandoFeedback } = props || {};
  const otsEnvelope = data?.ots;
  const otsRaw = Array.isArray(otsEnvelope?.data)
    ? otsEnvelope.data
    : Array.isArray(otsEnvelope)
      ? otsEnvelope
      : [];
  const br = getSessionBackendRole() || 'admin';
  const ots = getAllOTs(filtrarOtsPorRolBackend(otsRaw, br));

  const section = el('hnf-cc hnf-cc-mando-v2', 'section');
  section.setAttribute('aria-label', 'Centro de Control HNF');

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

  let ingresoPipeline = 0;
  for (const o of ots) {
    const sl = mapOtToSimpleLane(o);
    if (sl === 'simp_ingreso' || sl === 'simp_proceso') {
      ingresoPipeline += Number(o.montoCobrado) || Number(o.costoTotal) || 0;
    }
  }
  const ingresoLabel =
    ingresoPipeline > 0 ? `$${Math.round(ingresoPipeline).toLocaleString('es-CL')}` : '$0';

  let nSinEvidencia = 0;
  let firstOtSinEv = null;
  for (const o of ots) {
    if (mapOtToSimpleLane(o) === 'simp_finalizadas') continue;
    if (getEvidenceGaps(o).length > 0) {
      nSinEvidencia += 1;
      firstOtSinEv = firstOtSinEv || o;
    }
  }

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
      p.style.color = '#3f3f46';
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
  qLead.style.color = '#18181b';
  qLead.textContent = 'Nueva OT (3 pasos)';
  quickSheet.append(qLead, qStepsDots, qGrid, qNav, qStatus);
  paintQuick();

  let kanbanSetActive = () => {};

  const body = el('hnf-cc__body');
  body.style.flexDirection = 'column';
  body.style.position = 'relative';

  const { element: boardEl, setActiveShell } = createSimpleKanbanBoard({
    ots,
    onSelectOt: (ot, shell) => {
      openDrawer(ot, shell);
    },
    onDropOnLane: (ot, simpleLaneId) => {
      void (async () => {
        const commitLane = simpleLaneToCommitLane(simpleLaneId);
        if (typeof actions?.commitKanbanLane === 'function') {
          const r = await actions.commitKanbanLane(ot, commitLane);
          if (!r?.ok) return;
          return;
        }
        const r = persistEstadoOperativo(ot, commitLane);
        if (!r.ok) window.alert(r.error || 'No se pudo mover de columna');
        else if (typeof reloadApp === 'function') void reloadApp();
      })();
    },
    onDetail: (ot, shell) => {
      openDrawer(ot, shell);
    },
  });
  kanbanSetActive = setActiveShell;

  const headerV2 = createMandoHeaderV2({
    integrationStatus,
    onSync: () => {
      if (typeof reloadApp === 'function') void reloadApp();
    },
  });

  const nRiesgoKpi = opKpi.riesgoOperativo || 0;
  const nPendLyn = jSig.nPendAprobacion || 0;
  const kpisV2 = createMandoKpisV2({
    activas: opKpi.activas ?? 0,
    riesgo: nRiesgoKpi,
    pendLyn: nPendLyn,
    ingresoProcesoLabel: ingresoLabel,
  });

  const jarvisHeadline =
    nSinEvidencia > 0
      ? `ATENCIÓN: ${nSinEvidencia} OT sin evidencia`
      : jSig.nRiesgo > 0
        ? `${jSig.nRiesgo} OT con riesgo detectado`
        : 'Operación estable';
  const jarvisSub =
    nSinEvidencia > 0
      ? 'Acción: Revisar ahora (pestaña Evidencia en el detalle).'
      : String(jSig.suggestion || 'Sin alertas críticas en este momento.');

  const jarvisHero = createMandoJarvisHero({
    headline: jarvisHeadline,
    subline: jarvisSub,
    cta: 'Ver detalle',
    onCta: () => {
      const target = firstOtSinEv || jSig.focoOt;
      if (target) {
        openDrawer(target, null);
        if (nSinEvidencia > 0 && getEvidenceGaps(target).length > 0) {
          activeTab = 'evidencia';
          renderTabs();
          tabBodies.replaceChildren(renderTabBody(target, activeTab));
        }
      } else {
        document.querySelector('.hnf-mv2-jarvis-hero')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
  });

  const toggleQuick = () => {
    quickSheet.hidden = !quickSheet.hidden;
    if (!quickSheet.hidden) {
      quickStep = 0;
      paintQuick();
    }
  };

  const firstPendLyn = ots.find((o) => mapOtToSimpleLane(o) === 'simp_pendiente_lyn');

  const quickBar = createMandoQuickBar({
    onNuevaOt: toggleQuick,
    onDocumento: () => navigateToView?.('ingreso-operativo'),
    onMapa: () => navigateToView?.('gestion-ot'),
    onAprobarPend: () => {
      if (firstPendLyn) openDrawer(firstPendLyn, null);
      else {
        document.querySelector('.hnf-skb__lane:nth-child(3)')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },
  });

  const fabLine =
    nSinEvidencia > 0
      ? `${nSinEvidencia} sin evidencia`
      : jSig.nPendAprobacion > 0
        ? `${jSig.nPendAprobacion} pend. Lyn`
        : 'Jarvis';

  const jarvisFab = createJarvisFloatingAssistant({
    line: fabLine,
    onOpen: () => {
      const target = firstOtSinEv || jSig.focoOt || firstPendLyn;
      if (target) openDrawer(target, null);
      else document.querySelector('.hnf-mv2-jarvis-hero')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  });

  const mainFlow = el('hnf-mv2-flow');
  mainFlow.append(headerV2, kpisV2, jarvisHero, quickSheet, boardEl);
  body.append(mainFlow);

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
  foot.textContent = '';

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

  section.append(body, quickBar, jarvisFab);

  return section;
}
