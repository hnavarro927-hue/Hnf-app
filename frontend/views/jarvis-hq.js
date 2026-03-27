import {
  buildJarvisActionBoard,
  buildJarvisDailyBrief,
  buildJarvisDirectorBrief,
  computeJarvisExecutiveAlerts,
  getJarvisUnifiedState,
  runJarvisAutonomicCycle,
} from '../domain/jarvis-core.js';
import {
  getControlState,
  getJarvisAutonomiaEjecucion,
  resetToSafeDefaults,
  saveJarvisFrozenUnifiedSnapshot,
  setMode,
  setToggle,
} from '../domain/jarvis-control-center.js';
import {
  appendMemoryEvent,
  getAutonomicCycleMemorySummary,
  getInboundMeaningOnly,
  getJarvisMemorySummary,
  getJarvisRecurringPatterns,
  rememberInboundMeaning,
  rememberJarvisAction,
  rememberJarvisAlertSeen,
  rememberJarvisBrief,
} from '../domain/jarvis-memory.js';
import { isTabletMode } from '../domain/jarvis-ui.js';
import { getJarvisPulseState, startJarvisPulse, stopJarvisPulse } from '../domain/jarvis-pulse-engine.js';
import {
  buildJarvisExpansionActions,
  buildJarvisSupervisionAlerts,
  classifyIntakePayload,
  getCentroIngestaState,
  persistJarvisOperativeIngest,
  processIntakeFiles,
} from '../domain/jarvis-active-intake-engine.js';
import { jarvisOperativeEventsService } from '../services/jarvis-operative-events.service.js';
import { buildJarvisAlienCore } from '../domain/jarvis-alien-core-engine.js';
import { buildJarvisLiveBrain } from '../domain/jarvis-live-brain-engine.js';
import {
  analyzeJarvisImage,
  buildJarvisImageDecisionTriple,
  buildJarvisInterpretationPipeline,
} from '../domain/jarvis-image-intelligence.js';
import { jarvisRuntimeGetOperadorPack } from '../domain/jarvis-runtime-snapshot.js';
import { buildJarvisOperatorViewModel } from '../domain/jarvis-operador-engine.js';
import { buildOutlookIntakeHeadline } from '../domain/outlook-intelligence.js';
import {
  dismissJarvisOperationalTask,
  executeIntakeThroughActionPipeline,
  executeJarvisActions,
  getJarvisOperationalTasks,
} from '../domain/jarvis-action-engine.js';
import {
  aggregateMandoFromEventos,
  buildFlujoOperativoUnificado,
  ejecutarPropuestaGlobal,
} from '../domain/evento-operativo.js';
import {
  buildInboundInterpretationPipeline,
  buildInboundMeaning,
} from '../domain/jarvis-unified-intake-engine.js';
import { buildIntakeSalidaJarvis } from '../domain/jarvis-voice-engine.js';
import { buildJarvisSistemaVivoStrip } from '../domain/jarvis-sistema-vivo-engine.js';
import { buildJarvisDecisionEngine } from '../domain/jarvis-decision-engine.js';
import { createJarvisPresenceCore } from '../components/jarvis-presence-core.js';
import { createHnfEnvironmentContinuityPanel } from '../components/hnf-environment-continuity.js';
import { createJarvisOperativoNucleus } from '../components/jarvis-operativo-nucleus.js';
import { createHnfMandoPrincipalV2 } from '../components/hnf-mando-principal-v2.js';
import { createHnfExecutiveMandoStrip } from '../components/hnf-jarvis-mando-ejecutivo.js';
import { createHnfJarvisCommandImmersive } from '../components/hnf-jarvis-command-immersive.js';
import { buildExecutiveCommandModel } from '../domain/hnf-executive-command.js';
import {
  appendLiveIntakeEntry,
  createLiveIntakeEntriesPanel,
  refreshLiveIntakeEntriesPanel,
} from '../domain/jarvis-live-intake-memory.js';
import { buildJarvisOperationalBrain } from '../domain/jarvis-operational-brain.js';
import { syncJarvisInfinityState, markJarvisInfinityEventResolved } from '../domain/jarvis-infinity-engine.js';
import { enrichOperationalEvent, formatTraceableHeadline } from '../domain/jarvis-event-traceability.js';
import { buildTraceableInfinityEventRow } from '../components/jarvis-traceable-event.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';
import { patchResponsibilityTask } from '../services/responsibility.service.js';
import { hydrateExecutionAccountability } from '../src/components/execution-accountability.js';
import { listChannels, saveChannel } from '../domain/jarvis-channel-memory.js';
import {
  groupFlujoVivoForTimeline,
  iconForOrigenTipo,
  listMemoriaOperativa,
} from '../domain/jarvis-multi-source-intelligence.js';
import {
  getSelectedIntakeChannelId,
  interpretTextForChannel,
  setSelectedIntakeChannelId,
} from '../domain/jarvis-channel-intelligence.js';
import { buildTerrenoEstadoTable } from '../domain/jarvis-terreno-trace.js';
import { buildJarvisLiveCommandBrief } from '../domain/jarvis-live-command-brief.js';
import {
  buildJarvisDecideCommandModel,
  interpretOperativeEvent,
  interpretProcessResult,
  renderJarvisExecutiveUnderstand,
  renderJarvisExecutiveUnderstandFromEvent,
} from '../domain/jarvis-operational-interpretation.js';
import {
  buildJarvisTraceabilityModel,
  computeJarvisAlmaPhases,
  computeMapaOperativoHoy,
} from '../domain/jarvis-alma-operativa.js';
import { appendJarvisProposalDecision } from '../domain/jarvis-proposal-decisions.js';
import {
  buildJarvisIdleProposalPack,
  buildJarvisProposalPack,
  buildSyntheticOperativeEventFromClassification,
} from '../domain/jarvis-proposal-engine.js';
import { createJarvisLiveCommandLayer } from '../components/jarvis-live-command-layer.js';
import { getStoredOperatorName } from '../config/operator.config.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

const escHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmtAt = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

function buildJarvisSeaBar(navigateToView, onRefresh) {
  const bar = document.createElement('section');
  bar.className = 'jarvis-sea-bar tarjeta';
  const h = document.createElement('h2');
  h.className = 'jarvis-sea-bar__title';
  h.textContent = 'Acciones rápidas';
  const grid = document.createElement('div');
  grid.className = 'jarvis-sea-bar__grid';
  const rows = [
    { label: 'Cargar evidencias', view: 'clima', taskId: 'sea_ot_evidencia' },
    { label: 'Ingresar correos', view: 'jarvis-intake', taskId: 'sea_outlook' },
    { label: 'Registrar oportunidad comercial', view: 'oportunidades', taskId: 'sea_oportunidades' },
    { label: 'Cerrar OT', view: 'clima', taskId: 'sea_ot_evidencia' },
    { label: 'Actualizar planificación', view: 'planificacion', taskId: 'sea_calendario' },
    { label: 'Ingresar documento técnico', view: 'documentos-tecnicos', taskId: 'sea_documentos' },
  ];
  for (const r of rows) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button jarvis-sea-bar__btn';
    b.textContent = r.label;
    b.addEventListener('click', async () => {
      if (r.taskId) {
        try {
          await patchResponsibilityTask(r.taskId, 'en_proceso');
        } catch {
          /* API opcional */
        }
      }
      if (typeof navigateToView === 'function') navigateToView(r.view);
      if (typeof onRefresh === 'function') await onRefresh();
    });
    grid.append(b);
  }
  bar.append(h, grid);
  return bar;
}

const BUCKET_ORDER = [
  'ejecutar_hoy',
  'revisar_hoy',
  'aprobar_hoy',
  'cobrar_hoy',
  'vender_hoy',
  'escalar_a_hernan',
  'escalar_a_lyn',
  'seguimiento',
];

function flattenTopActions(board, limit = 7) {
  const order = ['ejecutar_hoy', 'cobrar_hoy', 'aprobar_hoy', 'revisar_hoy', 'vender_hoy', 'seguimiento'];
  const out = [];
  const b = board?.buckets || {};
  for (const key of order) {
    for (const a of b[key] || []) {
      out.push({ ...a, bucket: key });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function mergeBucket(board, auto, key) {
  const items = [];
  for (const a of board?.buckets?.[key] || []) {
    items.push({
      kind: 'board',
      titulo: a.titulo,
      detalle: a.motivo,
      nav: a.nav,
      severidad: a.prioridad <= 1 ? 'critical' : a.prioridad === 2 ? 'warning' : 'info',
      origen: a.origen || 'tablero',
      impacto: a.impactoEsperado || null,
      dueño: null,
      raw: a,
    });
  }
  for (const t of auto?.plan?.buckets?.[key] || []) {
    items.push({
      kind: 'mape',
      titulo: t.titulo,
      detalle: t.motivo,
      nav: t.nav,
      severidad: t.prioridad <= 1 ? 'critical' : t.prioridad === 2 ? 'warning' : 'info',
      origen: t.origen || 'MAPE',
      impacto: null,
      dueño: null,
      raw: t,
    });
  }
  return items;
}

function feedFromUnified(unified, brief, board) {
  const lines = [];
  const live = unified.liveIngestion;
  if (live?.currentSignals?.[0]) lines.push(live.currentSignals[0]);
  const hv = brief.historicalVault;
  if (hv && (hv.totalRecords > 0 || hv.patternsCount > 0)) {
    lines.push(
      `Vault: ${hv.totalRecords} registro(s), ${hv.patternsCount} patrón(es)${hv.lastImportAt ? ` · última carga ${String(hv.lastImportAt).slice(0, 10)}` : ''}.`
    );
  }
  const q = unified.intelBrief?.executionQueue || [];
  const crit = q.filter((x) => x.tipo === 'CRITICO').length;
  if (crit) lines.push(`Intel: ${crit} ítem(es) crítico(s) en cola ejecutable.`);
  const autoN = unified.autopilot?.classified?.automaticasSeguras?.length ?? 0;
  if (autoN) lines.push(`Autopilot: ${autoN} acción(es) catalogada(s) automática segura.`);
  const pot = brief.comercial?.montoPotencial ?? 0;
  if (pot > 0) lines.push(`Comercial mes: potencial ~$${fmtMoney(pot)}.`);
  const totalBoard = Object.values(board?.buckets || {}).reduce((s, arr) => s + arr.length, 0);
  if (totalBoard) lines.push(`Acciones en tablero: ${totalBoard}.`);
  if (!lines.length) lines.push('Corte sin pendientes críticos visibles — validar toggles de ingesta si ves silencio.');
  return lines;
}

function modeChip(mode) {
  const m = {
    off: 'Apagado',
    observe: 'Observación',
    assist: 'Asistido',
    autonomic_safe: 'Autónomo seguro',
  };
  return m[mode] || mode;
}

function buildJarvisEstadoActualStrip(brain) {
  const sec = document.createElement('section');
  sec.className = 'jarvis-one-core-estado tarjeta';
  sec.setAttribute('aria-label', 'Estado actual del sistema');
  const h = document.createElement('h2');
  h.className = 'jarvis-one-core-estado__title';
  h.textContent = 'Estado actual del sistema';
  const p = document.createElement('p');
  p.className = 'jarvis-one-core-estado__line';
  const pr = brain?.presencia || {};
  p.textContent = `${pr.estado || '—'} · ${String(pr.lineaPrincipal || '—').slice(0, 160)} · Datos ${pr.completitudPct ?? '—'}%`;
  sec.append(h, p);
  return sec;
}

function buildJarvisQueHacerHoy(opts) {
  const {
    result,
    execPack,
    infinity,
    navigateToView,
    refresh,
    planOtsN,
    calAlertsN,
  } = opts;
  const sec = document.createElement('section');
  sec.className = 'jarvis-que-hacer-hoy tarjeta';
  const h = document.createElement('h2');
  h.className = 'jarvis-que-hacer-hoy__title';
  h.textContent = 'QUÉ HACER HOY';
  const grid = document.createElement('div');
  grid.className = 'jarvis-que-hacer-hoy__grid';

  const mkCard = (title, items, actionLabel, view) => {
    const card = document.createElement('div');
    card.className = 'jarvis-que-hacer-hoy__card';
    const th = document.createElement('div');
    th.className = 'jarvis-que-hacer-hoy__card-title';
    th.textContent = title;
    const ul = document.createElement('ul');
    ul.className = 'jarvis-que-hacer-hoy__ul';
    for (const it of (items || []).slice(0, 3)) {
      const li = document.createElement('li');
      li.textContent = typeof it === 'string' ? it : String(it?.text || it?.title || it?.mensaje || it);
      ul.append(li);
    }
    if (!ul.childElementCount) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Sin pendientes inmediatos con los datos actuales';
      ul.append(li);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-button jarvis-cc-btn-touch jarvis-que-hacer-hoy__btn';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      if (view && typeof navigateToView === 'function') navigateToView(view);
      if (typeof refresh === 'function') refresh();
    });
    card.append(th, ul, btn);
    return card;
  };

  const crit = [];
  for (const a of execPack?.alerts || []) {
    if (crit.length >= 3) break;
    crit.push(a?.title || a?.mensaje || a?.detalle || String(a?.tipo || 'Alerta'));
  }
  for (const e of infinity?.eventosActivos || []) {
    if (crit.length >= 3) break;
    crit.push(formatTraceableHeadline(enrichOperationalEvent(e)));
  }

  const com = [];
  const opps = Array.isArray(result?.commercialOpportunities) ? result.commercialOpportunities : [];
  for (const o of opps) {
    if (com.length >= 3) break;
    com.push(String(o?.titulo || o?.cliente || o?.nombre || 'Seguimiento comercial'));
  }

  const cierres = [];
  const otsList = Array.isArray(result?.planOts) ? result.planOts : [];
  for (const o of otsList) {
    if (String(o?.estado || '') === 'terminado') continue;
    if (cierres.length >= 3) break;
    cierres.push(`OT ${o?.numero || o?.id || '—'} · ${o?.cliente || o?.tienda || 'revisar'}`);
  }

  const plan = [];
  if (calAlertsN) plan.push(`${calAlertsN} alerta(s) de agenda`);
  if (planOtsN) plan.push(`${planOtsN} OT en plan`);
  if (!plan.length) plan.push('Revisar calendario y visitas del día');

  grid.append(
    mkCard('Prioridad crítica', crit, 'Abrir comando', 'jarvis'),
    mkCard('Seguimiento comercial', com, 'Oportunidades comerciales', 'oportunidades'),
    mkCard('Cierres urgentes', cierres, 'Clima / OT', 'clima'),
    mkCard('Planificación del día', plan.slice(0, 3), 'Planificación', 'planificacion')
  );
  sec.append(h, grid);
  return sec;
}

function buildJarvisDineroPresionUnificado({ friction, infinity, opBrain }) {
  const cr = friction?.capaRealidad || {};
  const cv = infinity?.controlVivo || {};
  const evN = (infinity?.eventosActivos || []).length;
  const pres = infinity?.presion || [];
  const presLines = pres
    .slice(0, 4)
    .map((p) => `${p.tituloDisplay || p.titulo} (${p.tiempoLabel})`);
  const next = (opBrain?.accionesActivas?.principal || '').replace(/^\s*Acción:\s*/i, '').trim() || '—';

  const sec = document.createElement('section');
  sec.className = 'jarvis-dinero-presion tarjeta';
  sec.innerHTML = `<h2 class="jarvis-dinero-presion__title">DINERO Y PRESIÓN OPERATIVA</h2>
    <div class="jarvis-dinero-presion__grid">
      <div class="jarvis-dinero-presion__cell"><span class="jarvis-dinero-presion__k">Dinero en riesgo</span><span class="jarvis-dinero-presion__v jarvis-dinero-presion__v--riesgo">$${fmtMoney(cv.dineroRiesgo || 0)}</span></div>
      <div class="jarvis-dinero-presion__cell"><span class="jarvis-dinero-presion__k">Recuperable hoy</span><span class="jarvis-dinero-presion__v">$${fmtMoney(cr.ingresoProyectado || 0)}</span></div>
      <div class="jarvis-dinero-presion__cell"><span class="jarvis-dinero-presion__k">Fuga estimada</span><span class="jarvis-dinero-presion__v">$${fmtMoney(cr.fugaDinero || 0)}</span></div>
      <div class="jarvis-dinero-presion__cell"><span class="jarvis-dinero-presion__k">Prioridades activas</span><span class="jarvis-dinero-presion__v">${evN}</span></div>
    </div>
    <div class="jarvis-dinero-presion__block"><span class="jarvis-dinero-presion__k">Temas detenidos</span><p class="jarvis-dinero-presion__p"></p></div>
    <div class="jarvis-dinero-presion__block"><span class="jarvis-dinero-presion__k">Siguiente paso</span><p class="jarvis-dinero-presion__next"></p></div>`;
  sec.querySelector('.jarvis-dinero-presion__p').textContent = presLines.length
    ? presLines.join(' · ')
    : 'Sin temas detenidos en cola con los datos actuales';
  sec.querySelector('.jarvis-dinero-presion__next').textContent = next.slice(0, 220);
  return sec;
}

function buildJarvisTerrenoTraceSection() {
  const sec = document.createElement('section');
  sec.id = 'hnf-terreno-trace';
  sec.className = 'jarvis-terreno-trace tarjeta';
  sec.setAttribute('aria-label', 'Trazabilidad terreno');
  const h = document.createElement('h2');
  h.className = 'jarvis-terreno-trace__title';
  h.textContent = 'TRAZABILIDAD TERRENO';
  const table = document.createElement('table');
  table.className = 'jarvis-terreno-trace__table';
  table.innerHTML =
    '<thead><tr><th>Técnico</th><th>Tienda</th><th>Ingreso</th><th>Salida</th><th>Estado</th></tr></thead>';
  const tb = document.createElement('tbody');
  const rows = buildTerrenoEstadoTable();
  const fmtTs = (t) => {
    if (t == null) return '—';
    try {
      return new Date(t).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '—';
    }
  };
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'muted';
    td.textContent =
      'Sin marcas de ingreso/salida interpretadas — usá canal Reportes Clima en ingreso vivo o texto tipo “Nombre ingreso a tienda …”.';
    tr.append(td);
    tb.append(tr);
  } else {
    for (const r of rows.slice(0, 14)) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escHtml(r.tecnico)}</td><td>${escHtml(r.tienda)}</td><td>${escHtml(fmtTs(r.ingresoTs))}</td><td>${escHtml(fmtTs(r.salidaTs))}</td><td>${escHtml(r.estado)}</td>`;
      tb.append(tr);
    }
  }
  table.append(tb);
  sec.append(h, table);
  return sec;
}

function buildJarvisFlujoVivoOperacional() {
  const sec = document.createElement('section');
  sec.className = 'jarvis-flujo-op-msi tarjeta';
  sec.setAttribute('aria-label', 'Flujo vivo operacional');
  const h = document.createElement('h2');
  h.className = 'jarvis-flujo-op-msi__title';
  h.textContent = 'FLUJO VIVO OPERACIONAL';
  sec.append(h);
  const groups = groupFlujoVivoForTimeline(24);
  if (!groups.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent =
      'Sin entradas en timeline — al confirmar ingesta con canal seleccionado se registran líneas automáticas.';
    sec.append(p);
    return sec;
  }
  for (const g of groups) {
    const block = document.createElement('div');
    block.className = 'jarvis-flujo-op-msi__block';
    const head = document.createElement('div');
    head.className = 'jarvis-flujo-op-msi__head';
    const ico = iconForOrigenTipo(g.items[0]?.origen_tipo || 'sistema');
    head.textContent = `${ico.emoji} ${g.canal_label}`;
    const ul = document.createElement('ul');
    ul.className = 'jarvis-flujo-op-msi__tl';
    for (const it of g.items) {
      const li = document.createElement('li');
      li.className = 'jarvis-flujo-op-msi__tl-i';
      const tm = document.createElement('span');
      tm.className = 'jarvis-flujo-op-msi__t';
      try {
        tm.textContent = new Date(it.at).toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        tm.textContent = '—';
      }
      const tx = document.createElement('span');
      tx.className = 'jarvis-flujo-op-msi__txt';
      tx.textContent = String(it.linea || '—');
      li.append(tm, tx);
      ul.append(li);
    }
    block.append(head, ul);
    sec.append(block);
  }
  return sec;
}

function buildJarvisMultiSourceConfigPanel(onRefresh) {
  const det = document.createElement('details');
  det.className = 'jarvis-msi-config tarjeta';
  const sum = document.createElement('summary');
  sum.className = 'jarvis-msi-config__sum';
  sum.textContent = 'Configuración HNF — grupos, tipo y responsable por defecto';
  const body = document.createElement('div');
  body.className = 'jarvis-msi-config__body';

  const channels = listChannels().filter(
    (c) => String(c.id).startsWith('wa_') || c.id === 'mail_granleasing'
  );
  for (const c of channels) {
    const row = document.createElement('div');
    row.className = 'jarvis-msi-config__row';
    const title = document.createElement('div');
    title.className = 'jarvis-msi-config__ch-name';
    title.textContent = c.channel_name;
    const inAlias = document.createElement('input');
    inAlias.type = 'text';
    inAlias.className = 'jarvis-msi-config__input';
    inAlias.value = c.origen_alias || '';
    const labAlias = document.createElement('label');
    labAlias.className = 'jarvis-msi-config__field';
    const spA = document.createElement('span');
    spA.textContent = 'Alias visible (origen_nombre)';
    labAlias.append(spA, inAlias);

    const selTipo = document.createElement('select');
    selTipo.className = 'jarvis-msi-config__input';
    for (const opt of ['interno', 'cliente', 'operacion']) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selTipo.append(o);
    }
    selTipo.value = c.tipo_operativo || 'operacion';
    const labTipo = document.createElement('label');
    labTipo.className = 'jarvis-msi-config__field';
    const spT = document.createElement('span');
    spT.textContent = 'Tipo';
    labTipo.append(spT, selTipo);

    const inResp = document.createElement('input');
    inResp.type = 'text';
    inResp.className = 'jarvis-msi-config__input';
    inResp.value = c.default_responsable || '';
    const labResp = document.createElement('label');
    labResp.className = 'jarvis-msi-config__field';
    const spR = document.createElement('span');
    spR.textContent = 'Responsable default';
    labResp.append(spR, inResp);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-button jarvis-msi-config__save';
    btn.textContent = 'Guardar';
    btn.addEventListener('click', () => {
      saveChannel({
        ...c,
        origen_alias: inAlias.value.trim(),
        tipo_operativo: selTipo.value,
        default_responsable: inResp.value.trim(),
      });
      if (typeof onRefresh === 'function') onRefresh();
    });

    row.append(title, labAlias, labTipo, labResp, btn);
    body.append(row);
  }

  const memH = document.createElement('h3');
  memH.className = 'jarvis-msi-config__mem-h';
  memH.textContent = 'Memoria operativa viva (últimas acciones)';
  const memUl = document.createElement('ul');
  memUl.className = 'jarvis-msi-config__mem-ul';
  for (const m of listMemoriaOperativa()) {
    const li = document.createElement('li');
    li.className = 'jarvis-msi-config__mem-li';
    li.textContent = `${fmtAt(m.at)} · ${m.origen} · ${m.accion_tomada} → ${m.resultado}`;
    memUl.append(li);
  }
  if (!memUl.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin acciones registradas aún desde tarjetas MSI.';
    memUl.append(li);
  }
  body.append(memH, memUl);
  det.append(sum, body);
  return det;
}

function buildJarvisModulosNegocio(navigateToView, onRefresh) {
  const sec = document.createElement('section');
  sec.className = 'jarvis-modulos-negocio tarjeta';
  const h = document.createElement('h2');
  h.className = 'jarvis-modulos-negocio__title';
  h.textContent = 'MÓDULOS DE NEGOCIO';
  const grid = document.createElement('div');
  grid.className = 'jarvis-modulos-negocio__grid';
  const rows = [
    { id: 'clima', label: 'Clima / OT' },
    { id: 'planificacion', label: 'Planificación' },
    { id: 'flota', label: 'Flota' },
    { id: 'oportunidades', label: 'Oportunidades comerciales' },
    { id: 'admin', label: 'Administración' },
    { id: 'asistente', label: 'Asistente IA' },
    { id: 'jarvis-intake', label: 'Intake Hub' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'technical-documents', label: 'Documentos técnicos' },
    { id: 'operacion-control', label: 'Control operación' },
  ];
  for (const r of rows) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button jarvis-modulos-negocio__btn';
    b.textContent = r.label;
    b.addEventListener('click', () => {
      if (typeof navigateToView === 'function') navigateToView(r.id);
      if (typeof onRefresh === 'function') onRefresh();
    });
    grid.append(b);
  }
  sec.append(h, grid);
  return sec;
}

function buildJarvisOpBrainStack(brain, scrollIngesta, infinity, onRefresh, navigateToView, opts = {}) {
  const { oneCore = false, friction: stackFriction = null } = opts;
  const wrap = document.createElement('div');
  wrap.className = `jarvis-op-brain-stack jarvis-op-brain-stack--infinity${oneCore ? ' jarvis-op-brain-stack--one-core' : ''}`;

  if (!oneCore) {
    const flow = document.createElement('nav');
    flow.className = 'jarvis-op-layerflow';
    flow.setAttribute('aria-label', 'Capas operativas');
    brain.layerFlow.forEach((label, i) => {
      const step = document.createElement('span');
      step.className = 'jarvis-op-layerflow__step';
      step.textContent = label;
      flow.append(step);
      if (i < brain.layerFlow.length - 1) {
        const arr = document.createElement('span');
        arr.className = 'jarvis-op-layerflow__arr';
        arr.setAttribute('aria-hidden', 'true');
        arr.textContent = '→';
        flow.append(arr);
      }
    });
    wrap.append(flow);
  }

  const actSec = document.createElement('section');
  actSec.className = 'jarvis-op-acciones tarjeta';
  const actH = document.createElement('h2');
  actH.className = 'jarvis-op-acciones__title';
  actH.textContent = 'Acción prioritaria';
  actSec.append(actH);
  const aaEarly = brain.accionesActivas || {};
  const prinEarly = document.createElement('div');
  prinEarly.className = 'jarvis-op-acciones__principal';
  prinEarly.innerHTML = `<span class="jarvis-op-acciones__label">PRINCIPAL</span><p class="jarvis-op-acciones__text">${aaEarly.principal || '—'}</p>`;
  actSec.append(prinEarly);
  const secEarly = document.createElement('div');
  secEarly.className = 'jarvis-op-acciones__sec';
  const secLEarly = document.createElement('span');
  secLEarly.className = 'jarvis-op-acciones__label';
  secLEarly.textContent = 'Secundarias';
  const secUlEarly = document.createElement('ul');
  secUlEarly.className = 'jarvis-op-acciones__ul';
  for (const s of aaEarly.secundarias || []) {
    const li = document.createElement('li');
    li.textContent = s;
    secUlEarly.append(li);
  }
  if (!secUlEarly.children.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = '—';
    secUlEarly.append(li);
  }
  secEarly.append(secLEarly, secUlEarly);
  actSec.append(secEarly);
  if (!oneCore) wrap.append(actSec);

  const intel = document.createElement('section');
  intel.className = `jarvis-op-intel-bloque tarjeta jarvis-op-intel-bloque--${String(brain.presencia.estado).toLowerCase()}`;
  intel.setAttribute('aria-label', 'Presencia operativa');
  const intelH = document.createElement('h2');
  intelH.className = 'jarvis-op-intel-bloque__title';
  intelH.textContent = 'Directiva operativa';
  const intelMain = document.createElement('p');
  intelMain.className = 'jarvis-op-intel-bloque__main';
  intelMain.textContent = brain.presencia.lineaPrincipal;
  const intelInst = document.createElement('p');
  intelInst.className = 'jarvis-op-intel-bloque__inst';
  intelInst.textContent = brain.presencia.instruccion;
  const intelRow = document.createElement('div');
  intelRow.className = 'jarvis-op-intel-bloque__metrics';
  const mkMet = (k, v) => {
    const d = document.createElement('div');
    d.className = 'jarvis-op-metric';
    const kk = document.createElement('span');
    kk.className = 'jarvis-op-metric__k';
    kk.textContent = k;
    const vv = document.createElement('span');
    vv.className = 'jarvis-op-metric__v';
    vv.textContent = v;
    d.append(kk, vv);
    return d;
  };
  intelRow.append(
    mkMet('Estado', brain.presencia.estado),
    mkMet('Impacto económico', brain.presencia.impactoLabel),
    mkMet('Completitud datos', `${brain.presencia.completitudPct}%`)
  );
  intel.append(intelH, intelMain, intelInst, intelRow);

  const detCapas = document.createElement('details');
  detCapas.className = 'jarvis-op-stack-capas tarjeta';
  const detCapasSum = document.createElement('summary');
  detCapasSum.className = 'jarvis-op-stack-capas__sum';
  detCapasSum.textContent = 'Capa extendida: directiva, digest tras ingesta y estado por canal';
  detCapas.append(detCapasSum, intel);

  if (brain.respuestaIngesta?.lineas?.length) {
    const resp = document.createElement('section');
    resp.className = 'jarvis-op-respuesta-ingesta tarjeta';
    const rh = document.createElement('h2');
    rh.className = 'jarvis-op-respuesta-ingesta__title';
    rh.textContent = 'Digest tras ingesta';
    resp.append(rh);
    for (const ln of brain.respuestaIngesta.lineas) {
      const p = document.createElement('p');
      p.className = 'jarvis-op-respuesta-ingesta__line';
      p.textContent = ln;
      resp.append(p);
    }
    if (brain.respuestaIngesta.cierre) {
      const cierre = document.createElement('p');
      cierre.className = 'jarvis-op-respuesta-ingesta__cierre';
      cierre.textContent = brain.respuestaIngesta.cierre;
      resp.append(cierre);
    }
    detCapas.append(resp);
  }

  const ingest = document.createElement('section');
  ingest.className = 'jarvis-op-ingesta-canales tarjeta';
  const ingH = document.createElement('h2');
  ingH.className = 'jarvis-op-ingesta-canales__title';
  ingH.textContent = 'Estado por canal (resumen)';
  const ingGrid = document.createElement('div');
  ingGrid.className = 'jarvis-op-ingesta-canales__grid';
  for (const ch of brain.ingestChannels) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `jarvis-op-ingesta-cell ${ch.ok ? 'jarvis-op-ingesta-cell--ok' : 'jarvis-op-ingesta-cell--falta'}`;
    cell.innerHTML = `<span class="jarvis-op-ingesta-cell__label">${ch.label}</span><span class="jarvis-op-ingesta-cell__detalle">${ch.detalle}</span><span class="jarvis-op-ingesta-cell__estado">${ch.ok ? 'Recibido' : 'Falta / incompleto'}</span>`;
    cell.addEventListener('click', () => scrollIngesta());
    ingGrid.append(cell);
  }
  ingest.append(ingH, ingGrid);
  detCapas.append(ingest);
  wrap.append(detCapas);

  const evAct = infinity?.eventosActivos || [];
  const presionByKey = new Map((infinity?.presion || []).map((p) => [p.stableKey, p]));

  const evSec = document.createElement('section');
  evSec.className = 'jarvis-op-eventos tarjeta';
  const evH = document.createElement('h2');
  evH.className = 'jarvis-op-eventos__title';
  evH.textContent = 'Eventos operativos detectados';
  evSec.append(evH);
  if (!evAct.length) {
    const ok = document.createElement('p');
    ok.className = 'jarvis-op-eventos__empty';
    ok.textContent = oneCore
      ? 'Sin pendientes inmediatos con los datos actuales.'
      : 'Sin eventos operativos activos en memoria Infinity. Mantener ingesta; lo resuelto permanece auditado hasta archivar.';
    evSec.append(ok);
  } else {
    const list = document.createElement('ul');
    list.className = 'jarvis-op-eventos__list';
    for (const e of evAct) {
      const pr = presionByKey.get(e.stableKey);
      const brainEv = (brain.eventosOperativos || []).find((x) => x.stableKey === e.stableKey);
      const tiempo =
        brainEv?.tiempoSinAccion && brainEv.tiempoSinAccion !== '—'
          ? brainEv.tiempoSinAccion
          : pr?.tiempoLabel || '—';
      const stale = Boolean(e.sinMovimiento || pr?.sinMovimiento);
      const li = buildTraceableInfinityEventRow(e, {
        tiempoLabel: tiempo,
        onRefresh,
        navigateToView,
        markResolved: markJarvisInfinityEventResolved,
        stale,
        friction: stackFriction,
        infinity,
      });
      list.append(li);
    }
    evSec.append(list);

    const hist = infinity?.eventosHistorial || [];
    if (hist.length) {
      const detH = document.createElement('details');
      detH.className = 'jarvis-op-historial';
      const sumH = document.createElement('summary');
      sumH.className = 'jarvis-op-historial__sum muted small';
      sumH.textContent = `Historial Infinity (${hist.length} resueltos recientes)`;
      const listH = document.createElement('ul');
      listH.className = 'jarvis-op-eventos__list jarvis-op-eventos__list--historial';
      for (const he of hist) {
        listH.append(
          buildTraceableInfinityEventRow(he, {
            tiempoLabel: '—',
            onRefresh,
            navigateToView,
            markResolved: null,
            compact: true,
            stale: false,
            friction: stackFriction,
            infinity,
          })
        );
      }
      detH.append(sumH, listH);
      evSec.append(detH);
    }
  }
  wrap.append(evSec);

  const presSec = document.createElement('section');
  presSec.className = 'jarvis-op-presiona tarjeta';
  const presH = document.createElement('h2');
  presH.className = 'jarvis-op-presiona__title';
  presH.textContent = 'Presión operativa — temas detenidos';
  presSec.append(presH);
  if (!(infinity?.presion || []).length) {
    const p0 = document.createElement('p');
    p0.className = 'jarvis-op-presiona__empty muted';
    p0.textContent = oneCore
      ? 'Sin temas detenidos en cola con los datos actuales.'
      : 'Sin cola de presión activa.';
    presSec.append(p0);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'jarvis-op-presiona__list';
    for (const p of infinity.presion) {
      const li = document.createElement('li');
      li.className = `jarvis-op-presiona__item jarvis-op-presiona__item--${p.nivelUi || 'normal'}`;
      li.innerHTML = `<span class="jarvis-op-presiona__nivel">${escHtml(p.nivel)}</span><span class="jarvis-op-presiona__tit">${escHtml(p.tituloDisplay || p.titulo)}</span><span class="jarvis-op-presiona__meta">${escHtml(p.tiempoLabel)} · ${escHtml(p.assignee)}</span><span class="jarvis-op-presiona__impacto">${escHtml(p.impacto)}</span>`;
      ul.append(li);
    }
    presSec.append(ul);
    const leg = document.createElement('p');
    leg.className = 'jarvis-op-presiona__legend muted small';
    leg.textContent = 'Regla: < 1h NORMAL · 1h–6h ALERTA · > 6h CRÍTICO.';
    presSec.append(leg);
  }
  if (!oneCore) wrap.append(presSec);

  const seaSlot = document.createElement('div');
  seaSlot.setAttribute('data-hnf-sea-accountability', '1');
  seaSlot.className = 'jarvis-exec-acc jarvis-exec-acc--placeholder tarjeta';
  seaSlot.innerHTML = '<p class="muted">Cargando responsables y tareas…</p>';

  const seaBar = buildJarvisSeaBar(navigateToView, onRefresh);

  wrap.append(seaSlot);
  if (!oneCore) wrap.append(seaBar);

  const salud = document.createElement('section');
  salud.className = 'jarvis-op-salud tarjeta';
  salud.innerHTML = `<h2 class="jarvis-op-salud__title">Estado general del sistema</h2>
    <div class="jarvis-op-salud__grid">
      <div class="jarvis-op-salud__cell"><span class="jarvis-op-salud__k">Salud global</span><span class="jarvis-op-salud__v jarvis-op-salud__v--big">${brain.salud.headlinePct}%</span></div>
      <div class="jarvis-op-salud__cell"><span class="jarvis-op-salud__k">Datos cargados</span><span class="jarvis-op-salud__v">${brain.salud.datosPct}%</span></div>
      <div class="jarvis-op-salud__cell"><span class="jarvis-op-salud__k">Operación cubierta</span><span class="jarvis-op-salud__v">${brain.salud.operacionPct}%</span></div>
      <div class="jarvis-op-salud__cell"><span class="jarvis-op-salud__k">Decisiones activas</span><span class="jarvis-op-salud__v">${brain.salud.decisionesPct}%</span></div>
    </div>
    <p class="jarvis-op-salud__falta"><strong>Falta:</strong> ${brain.salud.falta}</p>`;

  const decide = document.createElement('section');
  decide.className = 'jarvis-op-decide tarjeta';
  decide.innerHTML = `<h2 class="jarvis-op-decide__title">Decisión operativa</h2>
    <p class="jarvis-op-decide__detectado"><strong>Detectó:</strong> ${brain.decide.detectado}</p>
    <p class="jarvis-op-decide__monto"><strong>Afecta:</strong> ${brain.decide.montoLabel}</p>
    <p class="jarvis-op-decide__accion"><strong>Qué hacer:</strong> ${brain.decide.accion}</p>`;

  const dist = document.createElement('section');
  dist.className = 'jarvis-op-distribuye tarjeta';
  const distH = document.createElement('h2');
  distH.className = 'jarvis-op-distribuye__title';
  distH.textContent = 'Distribución y asignación';
  dist.append(distH);
  const distUl = document.createElement('ul');
  distUl.className = 'jarvis-op-distribuye__list';
  for (const d of brain.distribuye) {
    const li = document.createElement('li');
    li.className = 'jarvis-op-distribuye__item';
    const rol = d.rol ? ` · ${d.rol}` : '';
    const ta = d.tiempoActivo ? ` · ${d.tiempoActivo}` : '';
    li.innerHTML = `<span class="jarvis-op-distribuye__who">${d.quien}${rol}</span><span class="jarvis-op-distribuye__task">${d.tarea}</span><span class="jarvis-op-distribuye__est">${d.estado}${ta}</span>`;
    distUl.append(li);
  }
  dist.append(distUl);

  const detSalud = document.createElement('details');
  detSalud.className = 'jarvis-op-stack-salud';
  const detSaludSum = document.createElement('summary');
  detSaludSum.className = 'jarvis-op-stack-salud__sum';
  detSaludSum.textContent = 'Detalle secundario: salud, decisión y distribución';
  detSalud.append(detSaludSum, salud, decide, dist);
  wrap.append(detSalud);

  return wrap;
}

export const jarvisHqView = ({
  data,
  integrationStatus,
  reloadApp,
  intelNavigate,
  lastDataRefreshAt,
  navigateToView,
} = {}) => {
  const root = document.createElement('section');
  root.className =
    'jarvis-hq jarvis-hq--command jarvis-hq--anunaki jarvis-hq--one-core jarvis-hq--ai-env';
  if (isTabletMode()) root.classList.add('jarvis-hq--tablet');

  if (integrationStatus === 'sin conexión') {
    const stub = getJarvisUnifiedState(data || {});
    const lbOffline = buildJarvisLiveBrain({ ...stub, hnfIntegrationStatus: 'sin conexión' });
    const off = document.createElement('div');
    off.className = 'integration-banner integration-banner--offline';
    const offTitle = document.createElement('strong');
    offTitle.textContent = 'Sin conexión al servidor.';
    off.append(offTitle, document.createTextNode(' Jarvis no consolida ERP en vivo; modo agente sigue activo con simulación y presión de carga local.'));
    const sim = document.createElement('div');
    sim.className = 'jarvis-cc-sim-ingesta tarjeta';
    const simH = document.createElement('h3');
    simH.className = 'jarvis-cc-sim-ingesta__title';
    simH.textContent = 'Autoingesta simulada — no paralizar comando';
    const simP = document.createElement('p');
    simP.className = 'jarvis-cc-sim-ingesta__lead';
    simP.textContent =
      lbOffline.alertaModoAgente ||
      'Sin backend, igual debés mover ingreso y riesgo con datos pegados o archivos.';
    const simUl = document.createElement('ul');
    simUl.className = 'jarvis-cc-sim-ingesta__ul';
    const ai = lbOffline.autoingestaSimulada;
    if (ai?.activa) {
      for (const line of [
        `Oportunidad perdida estimada (orden de magnitud): ~$${fmtMoney(ai.perdidaOportunidadEstimada)}`,
        `Riesgo operativo estimado: ${ai.riesgoOperativoEstimado}`,
        `Decisión forzada: ${ai.decision}`,
        ai.nota,
      ].filter(Boolean)) {
        const li = document.createElement('li');
        li.textContent = line;
        simUl.append(li);
      }
    }
    const simMuted = document.createElement('p');
    simMuted.className = 'muted small';
    simMuted.textContent = 'Ciclo agente: revisar flujo de entrada → detectar vacíos → cargar correo / OT / oportunidades en Centro de Ingesta cuando vuelva la red.';
    sim.append(simH, simP, simUl, simMuted);
    const envTechnicalOffline = createHnfEnvironmentContinuityPanel({
      lastDataRefreshAt,
      integrationStatus: 'sin conexión',
    });
    root.append(envTechnicalOffline, off, sim);
    return root;
  }

  const ctrl = getControlState();
  const unified = getJarvisUnifiedState(data || {});
  const result = unified;
  const execLevel = unified.jarvisExecutionLevel || ctrl.jarvisMode;
  const observeOnly = execLevel === 'observe';
  const showLegacyDashboard = observeOnly;
  /** Mando fluido: solo 4 bloques ejecutivos + ingreso mínimo; resto en legado cerrado. */
  const jarvisStructuralClean = !showLegacyDashboard;
  const flowIntel = result.jarvisFlowIntelligence ?? null;
  const pulseApi =
    typeof window !== 'undefined' && window.HNFJarvisPulse ? window.HNFJarvisPulse : { getJarvisPulseState };
  const pulseSnap = () => (pulseApi.getJarvisPulseState ? pulseApi.getJarvisPulseState() : getJarvisPulseState());
  const opLive = pulseSnap().running ? jarvisRuntimeGetOperadorPack() : null;
  const operator = buildJarvisOperatorViewModel(
    opLive || result.jarvisOperador || {},
    flowIntel || result.jarvisFlowIntelligence,
    { jarvisExecutionLevel: execLevel }
  );
  const alienCore = buildJarvisAlienCore({
    ...result,
    jarvisOperador: opLive || result.jarvisOperador,
  });
  const liveBrain = buildJarvisLiveBrain({
    ...result,
    jarvisOperador: opLive || result.jarvisOperador,
    jarvisAlienCore: alienCore,
    hnfIntegrationStatus: integrationStatus || 'conectado',
  });
  const planOtsN = Array.isArray(result.planOts) ? result.planOts.length : 0;
  const docsN = Array.isArray(result.technicalDocuments) ? result.technicalDocuments.length : 0;
  const oppsN = Array.isArray(result.commercialOpportunities) ? result.commercialOpportunities.length : 0;
  const dataVacuum =
    operator.jarvisDataMode === 'datos' && planOtsN === 0 && docsN === 0 && oppsN === 0;

  const live = unified.liveIngestion;
  const sustain = unified.sustainability || {};
  const brief = buildJarvisDailyBrief(unified);
  const board = buildJarvisActionBoard(unified);
  const memorySummary = getJarvisMemorySummary();
  const patterns = getJarvisRecurringPatterns();
  const execPack = computeJarvisExecutiveAlerts(unified, memorySummary);
  const friction = result.jarvisFrictionPressure || {};
  const directorText = buildJarvisDirectorBrief(unified);
  const auto = unified.autonomicState;
  const acMem = getAutonomicCycleMemorySummary();

  rememberJarvisBrief(brief);
  for (const a of (execPack.alerts || []).slice(0, 6)) {
    rememberJarvisAlertSeen(a);
  }

  const alienDecision = result.jarvisAlienDecisionCore || {};
  const presence = result.jarvisPresence || {};
  const soul = result.jarvisSoul || {};
  const liveDigest = result.jarvisLiveInboundDigest || { items: [] };
  const dataReq = result.jarvisDataRequests || {};
  const execVoice = result.jarvisExecutiveVoice || {};
  executeJarvisActions(alienDecision, { source: 'hq_render' });

  const sistemaVivo = buildJarvisSistemaVivoStrip(unified, {
    centroLast: getCentroIngestaState().last,
    feedLastIngestAt: result.outlookFeed?.lastIngestAt || null,
    fmtAt,
  });

  const refresh = async () => {
    if (typeof reloadApp === 'function') await reloadApp();
  };

  const scrollToCentroIngesta = () => {
    const el = document.getElementById('hnf-centro-ingesta');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const fold = el?.querySelector('.jarvis-hq-ingreso-evidencia-fold');
    if (fold && fold instanceof HTMLDetailsElement) fold.open = true;
  };

  const liveCmdModel = buildJarvisLiveCommandBrief({
    unified,
    data: data || {},
    alienDecision,
    friction,
    execPack,
    brief,
    operatorName: getStoredOperatorName(),
  });
  if (liveCmdModel.level >= 2) root.classList.add('jarvis-hq--command-critical');
  else if (liveCmdModel.level >= 1) root.classList.add('jarvis-hq--command-pressure');

  if (jarvisStructuralClean && integrationStatus !== 'sin conexión') {
    root.classList.add('jarvis-hq--immersive-shell');
    root.append(
      createHnfJarvisCommandImmersive({
        data: data || {},
        liveCmdModel,
        alienDecision,
        unified: result,
        lastDataRefreshAt,
        intelNavigate,
        navigateToView,
        reloadApp: refresh,
        getPulseState: pulseSnap,
      })
    );
    return root;
  }

  const mandoPrincipalV2 = createHnfMandoPrincipalV2({
    data: data || {},
    liveCmdModel,
    board,
    intelNavigate,
    navigateToView,
    reloadApp: refresh,
  });

  /* —— A. Command core (hero) —— */
  const hero = document.createElement('header');
  hero.className = 'jarvis-cc-hero jarvis-command-hero';
  const heroGrid = document.createElement('div');
  heroGrid.className = 'jarvis-cc-hero__grid jarvis-command-hero__grid';

  const heroMain = document.createElement('div');
  heroMain.className = 'jarvis-cc-hero__main jarvis-command-hero__main';
  const nucTone =
    alienDecision.estadoGlobal === 'critico' ? 'red' : alienDecision.estadoGlobal === 'tension' ? 'amber' : 'green';
  const kicker = document.createElement('p');
  kicker.className = 'jarvis-cc-kicker jarvis-command-hero__kicker';
  kicker.textContent = 'HNF Servicios Integrales · continuidad operacional';
  const h1 = document.createElement('h1');
  h1.className = 'jarvis-cc-title jarvis-command-hero__h1';
  h1.textContent = 'Jarvis · centro de mando';
  const presenceCore = createJarvisPresenceCore({
    presence,
    startup: unified.jarvisStartupSequence || {},
  });
  const chipBar = document.createElement('div');
  chipBar.className = 'jarvis-command-hero__chipbar';
  const mkCmdChip = (label, value, tone) => {
    const sp = document.createElement('span');
    sp.className = `jarvis-command-chip ${tone ? `jarvis-command-chip--${tone}` : 'jarvis-command-chip--neutral'}`;
    const lb = document.createElement('span');
    lb.className = 'jarvis-command-chip__l';
    lb.textContent = label;
    const vl = document.createElement('span');
    vl.className = 'jarvis-command-chip__v';
    vl.textContent = value;
    sp.append(lb, vl);
    return sp;
  };
  const presionLabel =
    presence.voiceMode === 'presion' ? 'Alta' : presence.voiceMode === 'alerta' ? 'Elevada' : 'Controlada';
  const ingresoHoyVal = liveCmdModel.pulseTiles?.find((t) => t.key === 'ingresos')?.value ?? '—';
  chipBar.append(
    mkCmdChip('Modo', modeChip(ctrl.jarvisMode), 'cyan'),
    mkCmdChip('Presión', presionLabel, nucTone === 'red' ? 'red' : nucTone === 'amber' ? 'amber' : 'green'),
    mkCmdChip('Ingresos hoy', String(ingresoHoyVal), liveCmdModel.level >= 1 ? 'amber' : 'neutral'),
    mkCmdChip('Recepción', 'Activa · sin salida', 'neutral'),
    mkCmdChip('Sync', fmtAt(lastDataRefreshAt), 'neutral'),
    mkCmdChip('Prioridad', (presence.summaryLine || 'Vigilancia').slice(0, 56) + ((presence.summaryLine || '').length > 56 ? '…' : ''), 'neutral')
  );
  const cp = liveCmdModel.cerebroPulse;
  if (cp?.estado) {
    const tone =
      cp.semaforo === 'rojo' ? 'red' : cp.semaforo === 'ambar' ? 'amber' : 'green';
    chipBar.append(
      mkCmdChip('Cerebro vivo', `${cp.estado} · pri. ${cp.prioridad || '—'}`, tone)
    );
  }
  if (unified.jarvisFrozen) chipBar.append(mkCmdChip('Estado', 'Estado guardado congelado', 'amber'));
  const guiaP = document.createElement('p');
  guiaP.className = 'jarvis-command-hero__guia muted small';
  guiaP.textContent = liveCmdModel.liveBrief || presence.fraseGuia || soul.identityLine || '';
  heroMain.append(kicker, h1, presenceCore, chipBar, guiaP);

  const heroActions = document.createElement('div');
  heroActions.className = 'jarvis-cc-hero__actions jarvis-command-hero__cta';
  const mkBtn = (label, cls, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  heroActions.append(
    mkBtn('Clasificar e ingresar', 'primary-button jarvis-cc-btn-touch jarvis-command-hero__btn-combo', () => {
      scrollToCentroIngesta();
      queueMicrotask(() => document.getElementById('hnf-btn-jarvis-combo-ingest')?.click());
    }),
    mkBtn('Ir a ingreso vivo', 'secondary-button jarvis-cc-btn-touch jarvis-command-hero__btn-ingest', () => {
      scrollToCentroIngesta();
    }),
    mkBtn('Recalcular', 'secondary-button jarvis-cc-btn-touch jarvis-command-hero__btn-secondary', () => refresh()),
    mkBtn('Centro de ingesta', 'secondary-button jarvis-cc-btn-touch', () => {
      scrollToCentroIngesta();
    }),
    mkBtn('Guardar estado', 'secondary-button jarvis-cc-btn-touch', () => {
      saveJarvisFrozenUnifiedSnapshot(unified);
    }),
    mkBtn('Modo seguro', 'secondary-button jarvis-cc-btn-touch', () => {
      resetToSafeDefaults();
      refresh();
    })
  );

  let controlOpen = false;
  const controlPanel = document.createElement('div');
  controlPanel.className = 'jarvis-cc-control';
  controlPanel.hidden = true;

  const buildControlPanel = () => {
    controlPanel.innerHTML = '';
    const c = getControlState();
    const h = document.createElement('h3');
    h.className = 'jarvis-cc-control__title';
    h.textContent = 'Control maestro Jarvis';
    controlPanel.append(h);

    const modes = document.createElement('div');
    modes.className = 'jarvis-cc-modes';
    for (const m of [
      { id: 'off', label: 'Off' },
      { id: 'observe', label: 'Observar' },
      { id: 'assist', label: 'Asistir' },
      { id: 'autonomic_safe', label: 'Autónomo seguro' },
    ]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `jarvis-cc-mode-btn ${c.jarvisMode === m.id ? 'jarvis-cc-mode-btn--on' : ''}`;
      b.textContent = m.label;
      b.addEventListener('click', () => {
        setMode(m.id);
        refresh();
      });
      modes.append(b);
    }
    controlPanel.append(modes);

    const toggles = document.createElement('div');
    toggles.className = 'jarvis-cc-toggles';
    const tdef = c.jarvisToggles;
    for (const [key, lab] of Object.entries({
      ingestCurrentData: 'Datos operativos (OT, etc.)',
      ingestOutlook: 'Outlook / intake',
      ingestVault: 'Historical Vault',
      ingestDocuments: 'Documentos técnicos',
      ingestCommercial: 'Comercial',
      ingestCalendar: 'Calendario / planificación',
      ingestWhatsapp: 'WhatsApp feed',
      persistMapeMemory: 'Persistir MAPE en memoria',
      showExperimentalSignals: 'Señales experimentales',
    })) {
      const row = document.createElement('label');
      row.className = 'jarvis-cc-toggle-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = Boolean(tdef[key]);
      cb.addEventListener('change', () => {
        setToggle(key, cb.checked);
        refresh();
      });
      const sp = document.createElement('span');
      sp.textContent = lab;
      row.append(cb, sp);
      toggles.append(row);
    }
    controlPanel.append(toggles);
  };
  buildControlPanel();

  const btnControl = mkBtn('Centro de control', 'secondary-button jarvis-cc-btn-touch', () => {
    controlOpen = !controlOpen;
    controlPanel.hidden = !controlOpen;
    if (controlOpen) buildControlPanel();
  });

  heroActions.append(btnControl);
  heroGrid.append(heroMain, heroActions);
  hero.append(heroGrid, controlPanel);
  const envTechnical = createHnfEnvironmentContinuityPanel({ lastDataRefreshAt, integrationStatus, compact: true });
  const oneCoreMain = document.createElement('div');
  oneCoreMain.className = 'jarvis-one-core-main';
  if (jarvisStructuralClean) oneCoreMain.classList.add('jarvis-structural-clean-v1');
  const pageTail = document.createElement('div');
  pageTail.className = 'jarvis-one-core-page-tail';
  const jarvisSecondaryDeck = document.createElement('details');
  jarvisSecondaryDeck.className = 'jarvis-hq-secondary-deck';
  jarvisSecondaryDeck.open = false;
  const jarvisSecondaryDeckSum = document.createElement('summary');
  jarvisSecondaryDeckSum.className = 'jarvis-hq-secondary-deck__sum';
  jarvisSecondaryDeckSum.innerHTML =
    '<span class="jarvis-hq-secondary-deck__k">Comando extendido</span><span class="jarvis-hq-secondary-deck__h">Ingesta · ADN técnico · diagnóstico · memoria · paneles</span>';
  const legacyBulkFold = document.createElement('details');
  legacyBulkFold.className = 'jarvis-hq-legacy-bulk-fold tarjeta';
  const legacyBulkSum = document.createElement('summary');
  legacyBulkSum.className = 'jarvis-hq-legacy-bulk-fold__sum';
  legacyBulkSum.textContent = 'Panel secundario';
  legacyBulkFold.append(legacyBulkSum);
  const appendJarvisSecondaryPanel = (el) => {
    if (jarvisStructuralClean) legacyBulkFold.append(el);
    else jarvisSecondaryDeck.append(el);
  };
  const stagePrimary = document.createElement('div');
  stagePrimary.className = 'jarvis-hq-stage-primary';
  jarvisSecondaryDeck.append(jarvisSecondaryDeckSum, oneCoreMain);
  const executiveStrip = createHnfExecutiveMandoStrip({
    model: data?.hnfAdn?.executiveCommand || buildExecutiveCommandModel(data || {}),
    intelNavigate,
    navigateToView,
  });
  root.append(executiveStrip, mandoPrincipalV2, jarvisSecondaryDeck);

  const sistemaStrip = document.createElement('section');
  sistemaStrip.className = 'jarvis-sistema-vivo';
  sistemaStrip.setAttribute('aria-label', 'Sistema vivo');
  const sTitle = document.createElement('h2');
  sTitle.className = 'jarvis-sistema-vivo__title';
  sTitle.textContent = 'SISTEMA VIVO — RECEPCIÓN Y DECISIÓN';
  const sGrid = document.createElement('div');
  sGrid.className = 'jarvis-sistema-vivo__grid';
  for (const col of sistemaVivo.columns || []) {
    const cell = document.createElement('div');
    cell.className = 'jarvis-sistema-vivo__cell';
    const lab = document.createElement('div');
    lab.className = 'jarvis-sistema-vivo__label';
    lab.textContent = col.label;
    const val = document.createElement('div');
    val.className = 'jarvis-sistema-vivo__value';
    val.textContent = col.value;
    cell.append(lab, val);
    sGrid.append(cell);
  }
  sistemaStrip.append(sTitle, sGrid);
  if (sistemaVivo.inferencias?.length) {
    const inf = document.createElement('p');
    inf.className = 'jarvis-sistema-vivo__infer muted small';
    inf.textContent = sistemaVivo.inferencias.join(' · ');
    sistemaStrip.append(inf);
  }

  const lastInbound = getInboundMeaningOnly(1)[0];
  const continuidad = document.createElement('section');
  continuidad.className = 'jarvis-continuidad-viva';
  const cTitle = document.createElement('h2');
  cTitle.className = 'jarvis-continuidad-viva__title';
  cTitle.textContent = 'ESTADO VIVO · CONTINUIDAD';
  const cGrid = document.createElement('div');
  cGrid.className = 'jarvis-continuidad-viva__grid';
  const mkCont = (label, val) => {
    const d = document.createElement('div');
    d.className = 'jarvis-continuidad-viva__cell';
    const lb = document.createElement('span');
    lb.className = 'jarvis-continuidad-viva__label';
    lb.textContent = label;
    const vl = document.createElement('span');
    vl.className = 'jarvis-continuidad-viva__value';
    vl.textContent = val;
    d.append(lb, vl);
    return d;
  };
  const relInterp = lastInbound?.at
    ? `Hace ${Math.max(1, Math.round((Date.now() - new Date(lastInbound.at).getTime()) / 60000))} min`
    : 'Sin interpretación reciente en memoria local';
  cGrid.append(
    mkCont('Ciclo autónomo', 'Cada 5 min · cola sugerida'),
    mkCont('Última sync datos', fmtAt(lastDataRefreshAt)),
    mkCont('Última interpretación', relInterp),
    mkCont('Señales', 'Monitoreo en curso · recepción activa')
  );
  const cFoot = document.createElement('p');
  cFoot.className = 'jarvis-continuidad-viva__foot muted small';
  const lastCycleAt = acMem?.ultimos?.[0]?.at;
  cFoot.textContent = lastCycleAt
    ? `Último ciclo MAPE registrado: ${fmtAt(lastCycleAt)} · el núcleo sigue en observación.`
    : 'Ciclos MAPE en memoria: listo para acumular señal tras recálculos.';
  continuidad.append(cTitle, cGrid, cFoot);

  const hqN = flowIntel?.hqNarrative || {};
  const outlookN = Array.isArray(result.outlookFeed?.messages) ? result.outlookFeed.messages.length : 0;
  const waMsgs = result.whatsappFeed?.messages;
  const waN = Array.isArray(waMsgs) ? waMsgs.length : result.whatsappFeed && typeof result.whatsappFeed === 'object' ? 1 : 0;
  const boardN = Object.values(board?.buckets || {}).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
  const calEntriesList = Array.isArray(result.operationalCalendar?.entries) ? result.operationalCalendar.entries : [];
  const calEntriesN = calEntriesList.length;
  const calAlertsN = Array.isArray(unified.operationalCalendarAlerts) ? unified.operationalCalendarAlerts.length : 0;
  const opBrain = buildJarvisOperationalBrain({
    unified,
    board,
    friction,
    alienDecision,
    dataVacuum,
    integrationStatus,
    centroLast: getCentroIngestaState().last,
    outlookN,
    waN,
    planOtsN,
    docsN,
    oppsN,
    calEntriesN,
    calAlertsN,
    liveDigestFirst: liveDigest.items?.[0] || null,
    boardN,
    alertsN: (execPack.alerts || []).length,
  });
  const infinity = syncJarvisInfinityState({
    brain: opBrain,
    dataVacuum,
    montoComercialPotencial: Number(brief?.comercial?.montoPotencial) || 0,
  });
  const operativoNucleus = createJarvisOperativoNucleus({
    alienDecision,
    friction,
    infinity,
    opBrain,
    lastDataRefreshAt,
    onIntakeChannelChange: refresh,
  });
  const estadoStrip = buildJarvisEstadoActualStrip(opBrain);
  const queHacerHoy = buildJarvisQueHacerHoy({
    result,
    execPack,
    infinity,
    navigateToView,
    refresh,
    planOtsN,
    calAlertsN,
  });
  const dineroPresion = buildJarvisDineroPresionUnificado({ friction, infinity, opBrain });
  const terrenoTrace = buildJarvisTerrenoTraceSection();
  const opStack = buildJarvisOpBrainStack(
    opBrain,
    scrollToCentroIngesta,
    infinity,
    refresh,
    navigateToView,
    { oneCore: true, friction }
  );
  const modulosNegocio = buildJarvisModulosNegocio(navigateToView, refresh);
  const seaBarQuick = buildJarvisSeaBar(navigateToView, refresh);
  seaBarQuick.classList.add('jarvis-sea-bar--one-core');
  const msiConfigPanel = buildJarvisMultiSourceConfigPanel(refresh);
  const flujoVivo = document.createElement('section');
  flujoVivo.className = 'jarvis-flujo-vivo jarvis-flujo-vivo--console jarvis-flujo-vivo--stream';
  const flujoH = document.createElement('h2');
  flujoH.className = 'jarvis-flujo-vivo__title';
  flujoH.textContent = 'Línea operativa — vida real';
  const flujoList = document.createElement('div');
  flujoList.className = 'jarvis-flujo-vivo__stream';
  const flujoDigestItems = jarvisStructuralClean
    ? (liveDigest.items || []).slice(0, 4)
    : liveDigest.items || [];
  for (const it of flujoDigestItems) {
    const canalLabel = String(it.canal || '—').toUpperCase();
    const headLine = [it.cliente && it.cliente !== '—' ? it.cliente : null, it.significa || it.queEntro]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 200);
    const streamItem = document.createElement('div');
    streamItem.className = 'jarvis-flujo-vivo__stream-item';
    const rail = document.createElement('span');
    rail.className = 'jarvis-flujo-vivo__rail';
    rail.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div');
    body.className = 'jarvis-flujo-vivo__stream-body';
    const head = document.createElement('div');
    head.className = 'jarvis-flujo-vivo__stream-head';
    head.textContent = `● ${headLine || `${canalLabel} · ingreso operativo`}`;
    const meta = document.createElement('div');
    meta.className = 'jarvis-flujo-vivo__stream-meta';
    meta.textContent = `${canalLabel} · ${fmtAt(it.at)}`;
    body.append(head, meta);
    const rows = [
      ['responsable', it.responsable],
      ['entró', it.queEntro],
      ['lectura', it.significa],
      ['riesgo', it.queRiesgoGenera],
      ['oportunidad', it.queOportunidadAbre],
      ['siguiente paso', it.queAccionRecomienda],
    ];
    if (!jarvisStructuralClean) {
      for (const [k, v] of rows) {
        if (!v) continue;
        const sub = document.createElement('div');
        sub.className = 'jarvis-flujo-vivo__stream-sub';
        sub.textContent = `→ ${k}: ${String(v)}`;
        body.append(sub);
      }
    }
    streamItem.append(rail, body);
    flujoList.append(streamItem);
  }
  if (!flujoList.childElementCount) {
    const empty = document.createElement('div');
    empty.className = 'jarvis-flujo-vivo__empty';
    const l1 = document.createElement('p');
    l1.className = 'jarvis-flujo-vivo__empty-line';
    l1.textContent = 'Consola sin eventos recientes en memoria.';
    const l2 = document.createElement('p');
    l2.className = 'muted small';
    l2.append(
      document.createTextNode('Usá '),
      (() => {
        const s = document.createElement('strong');
        s.textContent = 'Núcleo de ingreso vivo';
        return s;
      })(),
      document.createTextNode(
        ` o sincronizá correos registrados.${!outlookN ? ' Sin correo en vista — sigo por OT y contexto local.' : ''}`
      )
    );
    empty.append(l1, l2);
    flujoList.append(empty);
  }
  flujoVivo.append(flujoH, flujoList);

  const liveCommandUi = createJarvisLiveCommandLayer({
    model: liveCmdModel,
    navigateToView,
    refresh,
  });
  if (typeof window !== 'undefined') {
    if (window.__hnfJarvisDayCommandTimer) {
      clearInterval(window.__hnfJarvisDayCommandTimer);
      window.__hnfJarvisDayCommandTimer = null;
    }
    window.__hnfJarvisDayCommandTimer = setInterval(() => {
      try {
        liveCommandUi.tick?.();
      } catch {
        /* ignore */
      }
    }, 1000);
  }

  let paintJarvisDecide = () => {};
  const jarvisDecideCommandEl = document.createElement('section');
  jarvisDecideCommandEl.className = 'jarvis-hq-mando jarvis-hq-decide-command';
  jarvisDecideCommandEl.setAttribute('aria-label', 'Jarvis decide — mando');
  const jdH = document.createElement('h2');
  jdH.className = 'jarvis-hq-mando__title';
  jdH.textContent = 'JARVIS DECIDE';
  const jdStack = document.createElement('div');
  jdStack.className = 'jarvis-hq-mando__stack';
  const jdEyebrow = document.createElement('p');
  jdEyebrow.className = 'jarvis-hq-mando__eyebrow';
  jdEyebrow.textContent = 'Mando — acción principal e impacto en una sola lectura';
  const jdAccionText = document.createElement('p');
  jdAccionText.className = 'jarvis-hq-mando__accion';
  const jdMetaLine = document.createElement('p');
  jdMetaLine.className = 'jarvis-hq-mando__meta';
  const jdImpactStrong = document.createElement('strong');
  jdImpactStrong.className = 'jarvis-hq-mando__impact';
  const jdPresSpan = document.createElement('span');
  jdPresSpan.className = 'jarvis-hq-mando__presion';
  const jdRespSpan = document.createElement('span');
  jdRespSpan.className = 'jarvis-hq-mando__responsable-tag';
  jdMetaLine.append(
    jdImpactStrong,
    document.createTextNode(' \u00b7 '),
    jdPresSpan,
    document.createTextNode(' \u00b7 '),
    jdRespSpan
  );
  const jdFoot = document.createElement('p');
  jdFoot.className = 'jarvis-hq-mando__context muted small';
  jdStack.append(jdEyebrow, jdAccionText, jdMetaLine, jdFoot);
  jarvisDecideCommandEl.append(jdH, jdStack);

  /* —— Mando ejecutivo: rejilla ADN (observar) vs CAPA 1 compacta (mando real) —— */
  const execAdnRoot = document.createElement('section');
  execAdnRoot.className = 'jarvis-exec-adn-v1';
  execAdnRoot.setAttribute('aria-label', 'Jarvis mando ejecutivo');
  const execAdnBrand = document.createElement('p');
  execAdnBrand.className = 'jarvis-exec-adn-v1__brand';
  execAdnBrand.textContent = 'JARVIS VISIÓN EJECUTIVA ADN v1';
  const execAdnGrid = document.createElement('div');
  execAdnGrid.className = 'jarvis-exec-adn-v1__grid';

  const execEstadoChip = document.createElement('div');
  execEstadoChip.className = 'jarvis-exec-adn-v1__chip jarvis-exec-adn-v1__chip--ok';
  execEstadoChip.textContent = '🟢 En curso';
  const execCtaBtn = document.createElement('button');
  execCtaBtn.type = 'button';
  execCtaBtn.className = 'primary-button jarvis-cc-btn-touch jarvis-exec-adn-v1__cta';
  execCtaBtn.textContent = '—';

  /** @type {HTMLParagraphElement | null} */
  let execCapa1Dinero = null;
  /** @type {HTMLParagraphElement | null} */
  let execCapa1Ot = null;
  /** @type {HTMLUListElement | null} */
  let execCapa1Acciones = null;

  let execEstadoMetrics = null;
  let execAlertsList = null;
  let execFlowLine = null;

  if (jarvisStructuralClean) {
    execAdnRoot.classList.add('jarvis-exec-adn-v1--mando-real');
    const capa1 = document.createElement('div');
    capa1.className = 'jarvis-mando-capa1';
    const estadoRow = document.createElement('div');
    estadoRow.className = 'jarvis-mando-capa1__estado';
    const kEstado = document.createElement('span');
    kEstado.className = 'jarvis-mando-capa1__k';
    kEstado.textContent = 'Estado del día';
    estadoRow.append(kEstado, execEstadoChip);
    execCapa1Dinero = document.createElement('p');
    execCapa1Dinero.className = 'jarvis-mando-capa1__line';
    execCapa1Ot = document.createElement('p');
    execCapa1Ot.className = 'jarvis-mando-capa1__line';
    const accTit = document.createElement('p');
    accTit.className = 'jarvis-mando-capa1__k';
    accTit.textContent = 'Acciones sugeridas';
    execCapa1Acciones = document.createElement('ul');
    execCapa1Acciones.className = 'jarvis-mando-capa1__acciones';
    const flujoUnico = document.createElement('p');
    flujoUnico.className = 'jarvis-mando-capa1__flujo-unico muted small';
    flujoUnico.textContent = 'Flujo: Ingreso → Jarvis analiza → OT → ejecución → validación → cierre';
    execCtaBtn.classList.add('jarvis-mando-capa1__cta', 'jarvis-mando-capa1__cta--xl');
    capa1.append(
      estadoRow,
      execCapa1Dinero,
      execCapa1Ot,
      accTit,
      execCapa1Acciones,
      flujoUnico,
      execCtaBtn
    );
    execAdnRoot.append(capa1);
  } else {
    const blockA = document.createElement('div');
    blockA.className = 'jarvis-exec-adn-v1__block jarvis-exec-adn-v1__block--estado';
    const blockATitle = document.createElement('h3');
    blockATitle.className = 'jarvis-exec-adn-v1__block-title';
    blockATitle.textContent = 'Estado hoy';
    execEstadoMetrics = document.createElement('div');
    execEstadoMetrics.className = 'jarvis-exec-adn-v1__metrics';
    blockA.append(blockATitle, execEstadoChip, execEstadoMetrics);

    const blockB = document.createElement('div');
    blockB.className = 'jarvis-exec-adn-v1__block jarvis-exec-adn-v1__block--alertas';
    const blockBTitle = document.createElement('h3');
    blockBTitle.className = 'jarvis-exec-adn-v1__block-title';
    blockBTitle.textContent = 'Alertas críticas';
    execAlertsList = document.createElement('div');
    execAlertsList.className = 'jarvis-exec-adn-v1__alerts';
    blockB.append(blockBTitle, execAlertsList);

    const blockC = document.createElement('div');
    blockC.className = 'jarvis-exec-adn-v1__block jarvis-exec-adn-v1__block--cta';
    const blockCTitle = document.createElement('h3');
    blockCTitle.className = 'jarvis-exec-adn-v1__block-title';
    blockCTitle.textContent = 'Acción inmediata';
    blockC.append(blockCTitle, execCtaBtn);

    const blockD = document.createElement('div');
    blockD.className = 'jarvis-exec-adn-v1__block jarvis-exec-adn-v1__block--flujo';
    const blockDTitle = document.createElement('h3');
    blockDTitle.className = 'jarvis-exec-adn-v1__block-title';
    blockDTitle.textContent = 'Flujo del día';
    execFlowLine = document.createElement('p');
    execFlowLine.className = 'jarvis-exec-adn-v1__flow-line';
    execFlowLine.textContent = '—';
    blockD.append(blockDTitle, execFlowLine);

    execAdnGrid.append(blockA, blockB, blockC, blockD);
    execAdnRoot.append(execAdnBrand, execAdnGrid);
  }
  execAdnBrand.hidden = jarvisStructuralClean;

  const paintExecAdnVision = () => {
    const lm = liveCmdModel;
    const held = lm.heldMoney || { bloqueado: 0, fuga: 0 };
    const ingresosHoy = lm.pulseTiles?.find((t) => t.key === 'ingresos')?.value ?? 0;
    const otActivas = lm.pulseTiles?.find((t) => t.key === 'ots')?.value ?? 0;
    const evTile = lm.pulseTiles?.find((t) => t.key === 'evidencias')?.value ?? 0;
    const evLane = (lm.laneSummaries || []).find((l) => l.key === 'ev');
    const evidenciasHuecos = evLane?.count ?? evTile;
    const nivel = lm.level ?? 0;
    execEstadoChip.className = `jarvis-exec-adn-v1__chip jarvis-exec-adn-v1__chip--${nivel >= 2 ? 'crit' : nivel >= 1 ? 'warn' : 'ok'}`;
    execEstadoChip.textContent =
      nivel >= 2 ? '🔴 Crítico' : nivel >= 1 ? '🟡 Atención' : '🟢 OK';

    if (jarvisStructuralClean && execCapa1Dinero && execCapa1Ot) {
      const eventosUnificados = buildFlujoOperativoUnificado(data || {});
      const agg = aggregateMandoFromEventos(eventosUnificados);
      execCapa1Dinero.textContent = `Dinero en riesgo (eventos): ~$${fmtMoney(agg.dinero_en_riesgo)}`;
      const planOtsList = Array.isArray(data?.planOts) ? data.planOts : [];
      let otHuecos = 0;
      for (const o of planOtsList) {
        if (o.estado === 'terminado') continue;
        const g = getEvidenceGaps(o);
        if (Array.isArray(g) && g.length) otHuecos += 1;
      }
      execCapa1Ot.textContent = `OT abiertas con huecos de evidencia: ${otHuecos} · Eventos críticos: ${agg.eventos_criticos} · Bloqueados: ${agg.eventos_bloqueados} · Activos: ${agg.total_activos}`;
      if (execCapa1Acciones) {
        execCapa1Acciones.replaceChildren();
        const tops = flattenTopActions(board, 6);
        for (const t of tops.slice(0, 4)) {
          const li = document.createElement('li');
          li.textContent = String(t.titulo || t.motivo || t.detalle || 'Revisar').slice(0, 140);
          execCapa1Acciones.append(li);
        }
        if (!execCapa1Acciones.childElementCount) {
          const li = document.createElement('li');
          li.className = 'muted';
          li.textContent = 'Sin acciones en tablero en este snapshot — revisá ingresos o sincronizá.';
          execCapa1Acciones.append(li);
        }
      }
      if (agg.estado_general === 'critico') {
        execEstadoChip.className = 'jarvis-exec-adn-v1__chip jarvis-exec-adn-v1__chip--crit';
        execEstadoChip.textContent = '🔴 Crítico';
      } else if (agg.estado_general === 'atencion') {
        execEstadoChip.className = 'jarvis-exec-adn-v1__chip jarvis-exec-adn-v1__chip--warn';
        execEstadoChip.textContent = '🟡 Atención';
      } else {
        execEstadoChip.className = 'jarvis-exec-adn-v1__chip jarvis-exec-adn-v1__chip--ok';
        execEstadoChip.textContent = '🟢 OK';
      }
      execCtaBtn.textContent = 'EJECUTAR AHORA';
      execCtaBtn.onclick = () =>
        ejecutarPropuestaGlobal(eventosUnificados, { intelNavigate, navigateToView });
      return;
    }

    execEstadoMetrics.innerHTML = '';
    const mkMetric = (label, val, big) => {
      const d = document.createElement('div');
      d.className = 'jarvis-exec-adn-v1__metric' + (big ? ' jarvis-exec-adn-v1__metric--big' : '');
      const lb = document.createElement('span');
      lb.className = 'jarvis-exec-adn-v1__metric-k';
      lb.textContent = label;
      const vl = document.createElement('strong');
      vl.className = 'jarvis-exec-adn-v1__metric-v';
      vl.textContent = String(val);
      d.append(lb, vl);
      return d;
    };
    execEstadoMetrics.append(
      mkMetric('Ingresos hoy', ingresosHoy, true),
      mkMetric('Dinero en riesgo (detenido)', `~$${fmtMoney(held.bloqueado)}`, true),
      mkMetric('OT activas', otActivas, true),
      mkMetric('Evidencias / huecos', evidenciasHuecos, true),
    );

    const waMsgsArr = Array.isArray(data?.whatsappFeed?.messages) ? data.whatsappFeed.messages : [];
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const waToday = waMsgsArr.filter((m) => {
      const t = new Date(m.updatedAt || m.createdAt || 0).getTime();
      return Number.isFinite(t) && t >= dayStart.getTime();
    }).length;

    const alertRows = [];
    if ((evLane?.count || 0) > 0) {
      alertRows.push({
        text: `${evLane.count} pendiente(s) evidencia/huecos OT → riesgo al cierre`,
        tone: 'crit',
      });
    }
    for (const a of (execPack.alerts || []).slice(0, 2)) {
      const t = String(a.texto || a.mensaje || a.titulo || 'Alerta').replace(/\s+/g, ' ').trim();
      if (t) alertRows.push({ text: t.slice(0, 140), tone: 'warn' });
    }
    if (waToday === 0 && alertRows.length < 3) {
      alertRows.push({ text: 'Sin actividad WhatsApp indexada hoy', tone: 'amber' });
    }
    execAlertsList.replaceChildren();
    for (const row of alertRows.slice(0, 3)) {
      const el = document.createElement('div');
      el.className = `jarvis-exec-adn-v1__alert jarvis-exec-adn-v1__alert--${row.tone}`;
      el.textContent = row.text;
      execAlertsList.append(el);
    }
    if (!execAlertsList.childElementCount) {
      const el = document.createElement('div');
      el.className = 'jarvis-exec-adn-v1__alert jarvis-exec-adn-v1__alert--neutral';
      el.textContent = 'Sin alertas críticas en este snapshot.';
      execAlertsList.append(el);
    }

    const mandatory = String(lm.mandatoryAction || lm.headline || 'Revisá OT y evidencias en Clima.').slice(0, 160);
    execCtaBtn.textContent = mandatory;
    execCtaBtn.onclick = () => {
      const m = mandatory.toLowerCase();
      if (/whatsapp|wa\b/.test(m)) intelNavigate?.({ view: 'jarvis-intake' });
      else if (/evidencia|ot|cierre|clima/.test(m)) navigateToView?.('clima');
      else if (/aprobac|valid/.test(m)) navigateToView?.('planificacion');
      else if (/flota|traslado/.test(m)) navigateToView?.('flota');
      else intelNavigate?.({ view: 'operacion-control' });
    };

    const apprN = lm.pulseTiles?.find((t) => t.key === 'aprob')?.value ?? 0;
    const cierresN = lm.pulseTiles?.find((t) => t.key === 'cierres')?.value ?? 0;
    const validacionN = apprN + evTile;
    execFlowLine.textContent = `WhatsApp (${waToday}) → OT (${otActivas}) → Validación (${validacionN}) → Cierre (${cierresN})`;
  };
  paintExecAdnVision();

  const oneCoreExtended = document.createElement('details');
  oneCoreExtended.className = 'jarvis-exec-adn-v1__extended';
  const oneCoreExtendedSum = document.createElement('summary');
  oneCoreExtendedSum.className = 'jarvis-exec-adn-v1__extended-sum';
  oneCoreExtendedSum.textContent = 'Diagnóstico extendido · timeline · paneles (secundario)';
  oneCoreExtended.append(
    oneCoreExtendedSum,
    execAdnRoot,
    jarvisDecideCommandEl,
    liveCommandUi.element,
    operativoNucleus,
    estadoStrip,
    queHacerHoy,
    dineroPresion,
    flujoVivo,
    terrenoTrace,
    msiConfigPanel,
    opStack,
    ...(jarvisStructuralClean ? [] : [modulosNegocio, seaBarQuick]),
  );
  if (jarvisStructuralClean) {
    legacyBulkFold.append(modulosNegocio, seaBarQuick);
  }
  oneCoreMain.replaceChildren(stagePrimary, oneCoreExtended);
  const mandoFold = document.createElement('details');
  mandoFold.className = 'jarvis-hq-mando-fold tarjeta';
  const mandoSum = document.createElement('summary');
  mandoSum.className = 'jarvis-hq-mando-fold__sum';
  mandoSum.textContent = 'Presencia, chips y centro de control';
  mandoFold.append(mandoSum, hero);
  const seaAccSlot = opStack.querySelector('[data-hnf-sea-accountability]');
  if (seaAccSlot) {
    hydrateExecutionAccountability(seaAccSlot, {
      unified,
      integrationStatus,
      navigateToView,
      reloadApp: refresh,
      getEvidenceGaps,
    });
  }

  const telemetryFold = document.createElement('details');
  telemetryFold.className = 'jarvis-hq-telemetry-fold tarjeta';
  const telemetrySum = document.createElement('summary');
  telemetrySum.className = 'jarvis-hq-telemetry-fold__sum';
  telemetrySum.textContent = 'Sistema vivo y continuidad (vista secundaria)';
  telemetryFold.append(telemetrySum, sistemaStrip, continuidad);
  if (jarvisStructuralClean) {
    legacyBulkFold.append(telemetryFold, mandoFold, envTechnical);
    pageTail.append(legacyBulkFold);
  } else {
    pageTail.append(telemetryFold, mandoFold, envTechnical);
  }

  const cerebro = unified.jarvisCerebroOperativo || {};
  const cerebroSec = document.createElement('section');
  cerebroSec.className = 'jarvis-cerebro-vivo tarjeta';
  cerebroSec.innerHTML = `
    <h2 class="jarvis-cerebro-vivo__title">CEREBRO OPERATIVO VIVO</h2>
    <div class="jarvis-cerebro-vivo__grid">
      <div class="jarvis-cerebro-vivo__block"><span class="jarvis-cerebro-vivo__k">REALIDAD</span><p class="jarvis-cerebro-vivo__body"></p></div>
      <div class="jarvis-cerebro-vivo__block"><span class="jarvis-cerebro-vivo__k">IMPACTO</span><p class="jarvis-cerebro-vivo__body"></p></div>
      <div class="jarvis-cerebro-vivo__block"><span class="jarvis-cerebro-vivo__k">DECISIÓN</span><p class="jarvis-cerebro-vivo__body"></p></div>
      <div class="jarvis-cerebro-vivo__block"><span class="jarvis-cerebro-vivo__k">CONSECUENCIA</span><p class="jarvis-cerebro-vivo__body"></p></div>
    </div>`;
  const cbBodies = cerebroSec.querySelectorAll('.jarvis-cerebro-vivo__body');
  if (cbBodies[0]) cbBodies[0].textContent = cerebro.realidad || '—';
  if (cbBodies[1]) cbBodies[1].textContent = cerebro.impacto || '—';
  if (cbBodies[2]) cbBodies[2].textContent = cerebro.decision || '—';
  if (cbBodies[3]) cbBodies[3].textContent = cerebro.consecuencia || '—';
  const execFold = document.createElement('details');
  execFold.className = 'jarvis-hq-exec-fold tarjeta';
  const execFoldSum = document.createElement('summary');
  execFoldSum.className = 'jarvis-hq-exec-fold__sum';
  execFoldSum.textContent = 'Cerebro operativo y lectura ejecutiva (secundario)';
  execFold.append(execFoldSum, cerebroSec);

  const insight = document.createElement('section');
  insight.className = 'jarvis-insight-stack tarjeta';
  const insH = document.createElement('h2');
  insH.className = 'jarvis-insight-stack__title';
  insH.textContent = 'LECTURA EJECUTIVA';
  insight.append(insH);
  const insGrid = document.createElement('div');
  insGrid.className = 'jarvis-insight-stack__grid';
  const mkIns = (title, body) => {
    const box = document.createElement('div');
    box.className = 'jarvis-insight-stack__cell';
    const th = document.createElement('div');
    th.className = 'jarvis-insight-stack__k';
    th.textContent = title;
    const tb = document.createElement('div');
    tb.className = 'jarvis-insight-stack__v';
    tb.textContent = body;
    box.append(th, tb);
    return box;
  };
  const lastSig = liveDigest.items?.[0];
  insGrid.append(
    mkIns(
      'Última señal',
      lastSig
        ? `${lastSig.queEntro || ''} ${lastSig.significa ? `→ ${lastSig.significa}` : ''}`.trim() || '—'
        : 'Sin señal interpretada. Ingesta o sync para poblar.'
    ),
    mkIns(
      'Movimiento ahora',
      (execVoice.parrafos || []).join(' ') || alienDecision.focoDelDia || 'Primero cobro o cierre con evidencia.'
    ),
    mkIns(
      'Cuello de proceso',
      hqN.personaFrenando ||
        presence.cuelloResumido ||
        'El cuello no parece humano, sino de proceso — revisá etapas y dueños.'
    ),
    mkIns(
      'Fuga de caja',
      hqN.dondeSePierdeDinero || presence.dineroResumido || friction.capaRealidad?.riesgoOperativo || 'Sin fuga explícita en datos.'
    )
  );
  insight.append(insGrid);
  execFold.append(insight);
  appendJarvisSecondaryPanel(execFold);

  const memEvo = unified.jarvisMemoriaEvolutiva || {};
  const memSec = document.createElement('section');
  memSec.className = 'jarvis-memoria-evolutiva tarjeta';
  const memH = document.createElement('h2');
  memH.className = 'jarvis-memoria-evolutiva__title';
  memH.textContent = 'MEMORIA EVOLUTIVA JARVIS';
  const memUl = document.createElement('ul');
  memUl.className = 'jarvis-memoria-evolutiva__ul';
  for (const line of memEvo.lineas || []) {
    const li = document.createElement('li');
    li.textContent = line;
    memUl.append(li);
  }
  memSec.append(memH, memUl);
  appendJarvisSecondaryPanel(memSec);

  const radar = unified.jarvisExpansionRadar || {};
  const radarSec = document.createElement('section');
  radarSec.className = 'jarvis-radar-expansion tarjeta';
  const radarH = document.createElement('h2');
  radarH.className = 'jarvis-radar-expansion__title';
  radarH.textContent = 'RADAR DE EXPANSIÓN';
  const radarUl = document.createElement('ul');
  radarUl.className = 'jarvis-radar-expansion__ul';
  for (const ln of radar.lineas || []) {
    const li = document.createElement('li');
    li.textContent = ln;
    radarUl.append(li);
  }
  const radarFoot = document.createElement('p');
  radarFoot.className = 'muted small jarvis-radar-expansion__foot';
  radarFoot.textContent =
    'Estratégico, no administrativo: calor comercial, recurrencia, zonas y contratos posibles — alimentado por datos cargados.';
  radarSec.append(radarH, radarUl, radarFoot);
  appendJarvisSecondaryPanel(radarSec);

  const operadorTasks = getJarvisOperationalTasks();
  const olHPanel = buildOutlookIntakeHeadline(result.outlookFeed, result.outlookFollowUp);
  const operadorPanel = document.createElement('section');
  operadorPanel.className = 'jarvis-operador-panel tarjeta';
  const crOp = friction.capaRealidad || {};
  const bloqueadoOp = Math.round(Number(crOp.ingresoBloqueado) || 0);
  const fugaOp = Math.round(Number(crOp.fugaDinero) || 0);
  operadorPanel.innerHTML = `
    <h2 class="jarvis-operador-panel__title">Palancas — hoy</h2>
    <div class="jarvis-operador-panel__grid">
      <div class="jarvis-operador-panel__block jarvis-operador-panel__block--foco">
        <div class="jarvis-operador-panel__kicker">Foco</div>
        <p class="jarvis-operador-panel__body" id="hnf-jarvis-foco"></p>
      </div>
      <div class="jarvis-operador-panel__block jarvis-operador-panel__block--dinero">
        <div class="jarvis-operador-panel__kicker">Caja en riesgo</div>
        <p class="jarvis-operador-panel__body" id="hnf-jarvis-dinero"></p>
      </div>
      <div class="jarvis-operador-panel__block jarvis-operador-panel__block--opp">
        <div class="jarvis-operador-panel__kicker">Oportunidad</div>
        <ul class="jarvis-operador-panel__ul" id="hnf-jarvis-opp"></ul>
      </div>
      <div class="jarvis-operador-panel__block jarvis-operador-panel__block--tasks">
        <div class="jarvis-operador-panel__kicker">Obligatorias</div>
        <div id="hnf-jarvis-tasks"></div>
      </div>
      <div class="jarvis-operador-panel__block jarvis-operador-panel__block--full">
        <div class="jarvis-operador-panel__kicker">Si no movés nada</div>
        <p class="jarvis-operador-panel__body muted small" id="hnf-jarvis-sino"></p>
        <p class="jarvis-operador-panel__outlook muted small" id="hnf-jarvis-outlook-line"></p>
      </div>
    </div>
  `;
  operadorPanel.querySelector('#hnf-jarvis-foco').textContent = alienDecision.focoDelDia || '—';
  operadorPanel.querySelector('#hnf-jarvis-dinero').textContent = `Bloqueado ~$${fmtMoney(bloqueadoOp)} · Fuga / demora ~$${fmtMoney(fugaOp)} · Proyectado hoy ~$${fmtMoney(crOp.ingresoProyectado)}`;
  operadorPanel.querySelector('#hnf-jarvis-sino').textContent = alienDecision.siNoActua || '—';
  operadorPanel.querySelector('#hnf-jarvis-outlook-line').textContent = `Outlook (solo recepción) · Último ingreso: ${fmtAt(olHPanel.lastIngestAt)} · Nuevos: ${olHPanel.nuevos} · Críticos: ${olHPanel.criticos} · Pend. R/G/L: ${olHPanel.pendientesRomina}/${olHPanel.pendientesGery}/${olHPanel.pendientesLyn}`;
  const oppUl = operadorPanel.querySelector('#hnf-jarvis-opp');
  for (const o of alienDecision.oportunidades || []) {
    const li = document.createElement('li');
    li.textContent = o.texto || '—';
    oppUl.append(li);
  }
  if (!oppUl.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin oportunidades comerciales visibles — cargar comercial o ingreso de información.';
    oppUl.append(li);
  }
  const tasksMount = operadorPanel.querySelector('#hnf-jarvis-tasks');
  const topTasks = operadorTasks.filter((t) => t.obligatoria).slice(0, 8);
  const top3Acc = (alienDecision.top3Acciones || []).slice(0, 3);
  if (!topTasks.length && top3Acc.length) {
    const hint = document.createElement('ul');
    hint.className = 'jarvis-operador-panel__ul';
    for (const t of top3Acc) {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = t.responsable || '—';
      li.append(strong, document.createTextNode(` · ${t.accion} · ~$${fmtMoney(t.impactoDinero)} · `));
      const sp = document.createElement('span');
      sp.className = 'muted';
      sp.textContent = t.urgencia;
      li.append(sp);
      hint.append(li);
    }
    tasksMount.append(hint);
  } else {
    for (const t of topTasks.slice(0, 3)) {
      const row = document.createElement('div');
      row.className = 'jarvis-operador-panel__task';
      const badge = document.createElement('span');
      badge.className = 'jarvis-operador-panel__task-badge';
      badge.textContent = 'OBLIGATORIA';
      row.append(badge, document.createTextNode(` ${t.responsable} · ${t.accion} · ~$${fmtMoney(t.impactoDinero)}`));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary-button jarvis-operador-panel__task-done';
      btn.textContent = 'Hecho';
      btn.addEventListener('click', () => {
        dismissJarvisOperationalTask(t.id);
        refresh();
      });
      row.append(btn);
      tasksMount.append(row);
    }
    if (!tasksMount.childElementCount) {
      const p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = 'Sin tareas en cola local — el ciclo cada 5 min actualiza propuestas.';
      tasksMount.append(p);
    }
  }
  appendJarvisSecondaryPanel(operadorPanel);

  const solJarvis = document.createElement('section');
  solJarvis.className = 'jarvis-solicitudes tarjeta';
  const solH = document.createElement('h2');
  solH.className = 'jarvis-solicitudes__title';
  solH.textContent = 'Jarvis te pide esto';
  const solP = document.createElement('p');
  solP.className = 'muted small jarvis-solicitudes__lead';
  solP.textContent = 'Información que mejora precisión y decisiones — modo recepción / lectura únicamente.';
  const solUl = document.createElement('ul');
  solUl.className = 'jarvis-solicitudes__ul';
  for (const line of dataReq.solicitudes || []) {
    const li = document.createElement('li');
    li.textContent = line;
    solUl.append(li);
  }
  solJarvis.append(solH, solP, solUl);

  const superAlerts = buildJarvisSupervisionAlerts(unified);
  const expansionLines = buildJarvisExpansionActions(unified);
  let centroSnap = getCentroIngestaState();
  const feedLastIngestAt = result.outlookFeed?.lastIngestAt || null;
  let refreshAlmaOperativaUi = () => {};
  let almaRegisteredUntil = 0;
  const almaInterpretCtx = { lastInterp: null, lastRawEvent: null };

  if (liveBrain.alertaModoAgente) {
    const agentStrip = document.createElement('div');
    agentStrip.className = 'jarvis-cc-agente-banner tarjeta';
    agentStrip.textContent = liveBrain.alertaModoAgente;
    root.prepend(agentStrip);
  }

  const centroIngesta = document.createElement('section');
  centroIngesta.id = 'hnf-centro-ingesta';
  centroIngesta.className =
    'jarvis-uni-ingest jarvis-cc-centro-ingesta jarvis-live-intake-proto jarvis-core-mando-flow hnf-adn-centro';
  /** Capa 2 — líneas resumidas (solo modo mando estructural). */
  let paintIngresoResumido = () => {};
  const ciHead = document.createElement('div');
  ciHead.className = 'jarvis-uni-ingest__head jarvis-cc-centro-ingesta__head jarvis-core-mando-flow__head';
  const ciH = document.createElement('h2');
  ciH.className = 'jarvis-uni-ingest__title jarvis-cc-centro-ingesta__title';
  ciH.textContent = jarvisStructuralClean
    ? 'Operación activa'
    : 'Flujo operativo — ingreso integrado';
  const purpose = document.createElement('p');
  purpose.className = 'jarvis-uni-ingest__purpose-lead jarvis-live-intake-proto__sub';
  purpose.hidden = jarvisStructuralClean;
  purpose.textContent =
    'Un solo circuito: escribís abajo y el mando arriba se actualiza con la misma lectura que Jarvis Decide.';
  const ciFlowStrip = document.createElement('div');
  ciFlowStrip.className = 'jarvis-live-intake-flow jarvis-live-intake-flow--sr-only';
  ciFlowStrip.setAttribute('aria-hidden', 'true');
  ciFlowStrip.innerHTML = `<span class="jarvis-live-intake-flow__step jarvis-live-intake-flow__step--on" data-hnf-adn-step="ingresa"></span>
    <span class="jarvis-live-intake-flow__step" data-hnf-adn-step="interpreta"></span>
    <span class="jarvis-live-intake-flow__step" data-hnf-adn-step="interpreta"></span>
    <span class="jarvis-live-intake-flow__step" data-hnf-adn-step="decide"></span>
    <span class="jarvis-live-intake-flow__step" data-hnf-adn-step="ejecuta"></span>
    <span class="jarvis-live-intake-flow__step" data-hnf-adn-step="ejecuta"></span>`;
  const chBar = document.createElement('div');
  chBar.className = 'jarvis-intake-channel-bar';
  const chLab = document.createElement('label');
  chLab.className = 'jarvis-intake-channel-bar__label muted small';
  chLab.setAttribute('for', 'hnf-centro-intake-channel');
  chLab.textContent = 'Interpretar ingesta como canal operativo';
  const chSel = document.createElement('select');
  chSel.id = 'hnf-centro-intake-channel';
  chSel.className = 'jarvis-intake-channel-bar__select';
  chSel.setAttribute('aria-label', 'Canal operativo para interpretación');
  for (const c of listChannels()) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.channel_name;
    chSel.append(o);
  }
  chSel.value = getSelectedIntakeChannelId();
  chSel.addEventListener('change', () => {
    setSelectedIntakeChannelId(chSel.value);
    const topSel = document.getElementById('hnf-jarvis-intake-channel-select');
    if (topSel) topSel.value = chSel.value;
    refreshAlmaOperativaUi();
    paintIngresoResumido();
  });
  chBar.append(chLab, chSel);
  if (!jarvisStructuralClean) ciHead.append(ciH, purpose, chBar);
  else ciHead.append(ciH);

  const almaRoot = document.createElement('section');
  almaRoot.className = 'jarvis-alma-operativa jarvis-alma-operativa--neural';
  almaRoot.setAttribute('aria-label', 'Alma viva — flujo continuo');
  const almaH = document.createElement('h3');
  almaH.className = 'jarvis-alma-operativa__title';
  almaH.textContent = 'ALMA VIVA — circuito operativo';
  const almaSpine = document.createElement('div');
  almaSpine.className = 'jarvis-alma-spine';
  almaSpine.setAttribute('aria-label', 'Etapas del flujo');
  /** @type {HTMLDivElement[]} */
  const almaPhaseEls = [];
  const phaseDefs = [
    ['ingresa', 'INGRESO'],
    ['interpreta', 'ANÁLISIS'],
    ['decide', 'DECISIÓN'],
    ['ejecuta', 'ACCIÓN'],
    ['registra', 'RESULTADO'],
  ];
  phaseDefs.forEach(([key, lab]) => {
    const row = document.createElement('div');
    row.className = 'jarvis-alma-spine__row';
    const node = document.createElement('div');
    node.className = 'jarvis-alma-spine__node';
    node.dataset.phase = key;
    const dot = document.createElement('span');
    dot.className = 'jarvis-alma-spine__dot';
    dot.setAttribute('aria-hidden', 'true');
    const sp = document.createElement('span');
    sp.className = 'jarvis-alma-spine__label';
    sp.textContent = lab;
    node.append(dot, sp);
    row.append(node);
    almaSpine.append(row);
    almaPhaseEls.push(node);
  });

  const traceWrap = document.createElement('div');
  traceWrap.className = 'jarvis-alma-operativa__trace';
  const traceTitle = document.createElement('div');
  traceTitle.className = 'jarvis-alma-operativa__trace-head muted small';
  traceTitle.textContent = 'Trazabilidad — lectura continua';
  const traceFlow = document.createElement('div');
  traceFlow.className = 'jarvis-alma-operativa__trace-flow';
  traceFlow.textContent = 'Origen · requiere validación';
  traceWrap.append(traceTitle, traceFlow);

  const mapaWrap = document.createElement('div');
  mapaWrap.className = 'jarvis-alma-operativa__mapa';
  const mapaTitle = document.createElement('div');
  mapaTitle.className = 'jarvis-alma-operativa__mapa-head';
  mapaTitle.textContent = 'Mapa operativo hoy';
  const mapaBar = document.createElement('p');
  mapaBar.className = 'jarvis-alma-operativa__mapa-bar';
  mapaBar.textContent =
    'Ingresos hoy: 0 | En proceso: 0 | Críticos: 0 | Sin dueño: 0 | Cerrados: 0';
  mapaWrap.append(mapaTitle, mapaBar);
  almaRoot.append(almaH, almaSpine, traceWrap, mapaWrap);

  const mapIntakeArea = (c) => {
    const t = String(c?.tipoSalida || c?.tipo || '').toLowerCase();
    const canal = String(c?.canalSalida || c?.canal || '').toLowerCase();
    if (/comercial|cliente|opp|oportunidad|venta/.test(t) || canal === 'correo') return 'Comercial';
    if (/ot|t[eé]cn|obra|equipo|falla/.test(t) || canal === 'imagen') return 'Operaciones / OT';
    if (canal === 'whatsapp') return 'Comunicaciones';
    return 'Operación general';
  };

  const priLabel = (c) => {
    const u = String(c?.urgencia || 'media').toLowerCase();
    if (u === 'alta' || u === 'urgente' || u === 'crítica' || u === 'critica') return 'ALTA';
    if (u === 'baja') return 'BAJA';
    return 'MEDIA';
  };

  const detectLabel = (c) => {
    if (c?.generaOportunidad && c?.narrativaOportunidad) return String(c.narrativaOportunidad).slice(0, 140);
    if (c?.generaRiesgo && c?.narrativaRiesgo) return String(c.narrativaRiesgo).slice(0, 140);
    if (c?.accionInmediata) return String(c.accionInmediata).slice(0, 140);
    return `${c?.tipoSalida || c?.tipo || 'Ingreso'} · canal ${c?.canalSalida || c?.canal || '—'}`;
  };

  const nucleoIngestBridge = { onSelectEntry: null };
  const liveEntryPanelOptions = {
    get onSelectEntry() {
      return nucleoIngestBridge.onSelectEntry;
    },
  };
  let liveEntriesPanel = createLiveIntakeEntriesPanel(liveEntryPanelOptions);
  liveEntriesPanel.classList.add('jarvis-live-entries--in-centro');

  const refreshLiveEntries = () => {
    const n = refreshLiveIntakeEntriesPanel(liveEntriesPanel, liveEntryPanelOptions);
    if (n) liveEntriesPanel = n;
  };

  const ciLiveInsight = document.createElement('div');
  ciLiveInsight.className =
    'jarvis-live-intake-result jarvis-live-intake-result--neural jarvis-live-intake-result--empty';
  const liveH = document.createElement('h3');
  liveH.className = 'jarvis-live-intake-result__title';
  liveH.textContent = 'JARVIS DETECTÓ — formato ejecutivo';
  const liveSub = document.createElement('p');
  liveSub.className = 'muted small jarvis-live-intake-result__sub';
  liveSub.textContent =
    'Cuatro líneas: cliente, problema, acción, impacto. Misma lectura que arriba; vacíos → “requiere validación”.';
  const liveRows = document.createElement('div');
  liveRows.className = 'jarvis-live-intake-neural';
  const mkLiveRow = (k) => {
    const row = document.createElement('div');
    row.className = 'jarvis-live-intake-neural__line';
    const kk = document.createElement('span');
    kk.className = 'jarvis-live-intake-neural__k';
    kk.textContent = k;
    const vv = document.createElement('span');
    vv.className = 'jarvis-live-intake-neural__v';
    vv.textContent = 'requiere validación';
    row.append(kk, vv);
    liveRows.append(row);
    return vv;
  };
  const vExecCliente = mkLiveRow('CLIENTE');
  const vExecProblema = mkLiveRow('PROBLEMA');
  const vExecAccion = mkLiveRow('ACCIÓN');
  const vExecImpacto = mkLiveRow('IMPACTO');
  const liveActsLabel = document.createElement('div');
  liveActsLabel.className = 'jarvis-live-intake-result__acts-label';
  liveActsLabel.textContent = 'Acciones rápidas (misma lectura que arriba)';
  const liveActs = document.createElement('div');
  liveActs.className = 'jarvis-live-intake-result__actions';
  ciLiveInsight.append(liveH, liveSub, liveRows, liveActsLabel, liveActs);
  if (jarvisStructuralClean) {
    liveActsLabel.hidden = true;
    liveActs.hidden = true;
  }

  const runIntakeSideEffect = async (label) => {
    rememberJarvisAction(`Ingreso vivo: ${label}`, 'tomada', 'live_intake');
    await refresh();
  };

  const buildLiveActionButtons = (c) => {
    liveActs.innerHTML = '';
    const mkAct = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button jarvis-cc-btn-touch jarvis-live-intake-result__btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    const go = (view, memLabel) => () => {
      appendLiveIntakeEntry({
        tipo: c?.tipoSalida || c?.tipo || '—',
        resumen: String(vExecCliente.textContent || '').slice(0, 200),
        interpretacion: String(vExecProblema.textContent || '').slice(0, 200),
        responsable: String(c?.responsable || '—'),
        estado: 'acción UI',
        accion_tomada: memLabel,
        classificationSnapshot: c || null,
      });
      refreshLiveEntries();
      if (typeof navigateToView === 'function') navigateToView(view);
      runIntakeSideEffect(memLabel);
    };
    liveActs.append(
      mkAct('Asignar seguimiento', go('asistente', 'Asignar seguimiento')),
      mkAct('Crear tarea', () => {
        appendLiveIntakeEntry({
          tipo: c?.tipoSalida || c?.tipo || '—',
          resumen: String(vExecCliente.textContent || '').slice(0, 200),
          interpretacion: String(vExecProblema.textContent || '').slice(0, 200),
          responsable: String(c?.responsable || '—'),
          estado: 'tarea',
          accion_tomada: 'Crear tarea (memoria operativa)',
          classificationSnapshot: c || null,
        });
        refreshLiveEntries();
        rememberJarvisAction(String(c?.accionInmediata || 'Seguimiento ingreso vivo'), 'tomada', 'live_intake_task');
        runIntakeSideEffect('Crear tarea');
      }),
      mkAct('Registrar oportunidad', go('oportunidades', 'Registrar oportunidad comercial')),
      mkAct('Ir a clima / OT', go('clima', 'Registrar en clima')),
      mkAct('Ir a flota', go('flota', 'Registrar en flota')),
      mkAct('Documento técnico', go('documentos-tecnicos', 'Registrar documento')),
      mkAct('Planificación', go('planificacion', 'Registrar en planificación')),
      mkAct('Centro de mando', go('jarvis', 'Enviar al centro de mando')),
      mkAct('Intake Hub', go('jarvis-intake', 'Distribuir en Intake Hub')),
      mkAct('Memoria operativa', () => {
        appendMemoryEvent('live_intake_action', { canal: c?.canal, tipo: c?.tipoSalida });
        appendLiveIntakeEntry({
          tipo: c?.tipoSalida || c?.tipo || '—',
          resumen: String(vExecCliente.textContent || '').slice(0, 200),
          interpretacion: String(vExecProblema.textContent || '').slice(0, 200),
          responsable: String(c?.responsable || '—'),
          estado: 'memoria',
          accion_tomada: 'Guardar en memoria operativa',
          classificationSnapshot: c || null,
        });
        refreshLiveEntries();
        runIntakeSideEffect('Memoria operativa');
      }),
      mkAct('Escalar decisión', () => {
        appendLiveIntakeEntry({
          tipo: c?.tipoSalida || c?.tipo || '—',
          resumen: String(vExecCliente.textContent || '').slice(0, 200),
          interpretacion: String(vExecProblema.textContent || '').slice(0, 200),
          responsable: 'Hernan',
          estado: 'escalado',
          accion_tomada: 'Escalar decisión',
          classificationSnapshot: c || null,
        });
        refreshLiveEntries();
        rememberJarvisAction('Escalación Hernan — revisar ingreso vivo', 'sugerida', 'live_intake');
        runIntakeSideEffect('Escalar decisión');
      }),
      mkAct('Revisión administrativa', () => {
        appendLiveIntakeEntry({
          tipo: c?.tipoSalida || c?.tipo || '—',
          resumen: String(vExecCliente.textContent || '').slice(0, 200),
          interpretacion: String(vExecProblema.textContent || '').slice(0, 200),
          responsable: String(c?.responsable || '—'),
          estado: 'admin',
          accion_tomada: 'Marcar revisión administrativa',
          classificationSnapshot: c || null,
        });
        refreshLiveEntries();
        rememberJarvisAction('Revisión administrativa — ingreso vivo', 'tomada', 'live_intake');
        runIntakeSideEffect('Revisión administrativa');
      })
    );
  };

  const nzInsight = (v) => {
    const t = String(v ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t || t === '—' || t === 'Pendiente de completar — requiere validación humana.') {
      return 'requiere validación';
    }
    return t;
  };

  const formatExecImpacto = (interp, processResult, rawEv) => {
    const n =
      Number(interp?.impacto_dinero_referencia) ||
      Number(interp?.impactoEconomicoHeuristico) ||
      Number(processResult?.classification?.impactoEconomicoEstimado) ||
      Number(rawEv?.impactoEconomicoHeuristico ?? rawEv?.impactoEconomicoEstimado) ||
      0;
    if (n > 0) return `~$${Math.round(n).toLocaleString('es-CL')}`;
    return 'requiere validación';
  };

  const formatExecAccionLine = (interp) => {
    const acts = (interp.acciones_disponibles || []).filter(Boolean);
    if (acts.length) return nzInsight(acts.join(' · '));
    return nzInsight(interp.siguiente_paso || interp.accion_obligatoria);
  };

  const classificationForButtonsFromEvent = (ev) => ({
    tipoSalida: ev?.tipoSalida,
    tipo: ev?.tipo,
    canalSalida: ev?.canalSalida,
    canal: ev?.canal,
    excerpt: ev?.rawExcerpt || ev?.excerpt,
    responsable: ev?.responsableSugerido || ev?.responsable,
    urgencia: ev?.prioridad,
    generaOportunidad: ev?.generaOportunidad,
    generaRiesgo: ev?.generaRiesgo,
    accionInmediata: ev?.accionInmediata,
  });

  const applyNucleoVitality = (interp) => {
    ciLiveInsight.classList.remove(
      'jarvis-live-intake-result--critical',
      'jarvis-live-intake-result--pending',
      'jarvis-live-intake-result--processing',
      'jarvis-live-intake-result--resolved',
    );
    jarvisDecideCommandEl.classList.remove(
      'jarvis-hq-decide-command--critical',
      'jarvis-hq-decide-command--pending',
      'jarvis-hq-decide-command--processing',
    );
    if (interp && Date.now() < almaRegisteredUntil) {
      ciLiveInsight.classList.add('jarvis-live-intake-result--resolved');
      return;
    }
    if (!interp) return;
    const pr = String(interp.prioridad_raw || '').toUpperCase();
    const crit = pr === 'CRITICO' || interp.semaforo === 'rojo';
    if (crit) {
      ciLiveInsight.classList.add('jarvis-live-intake-result--critical');
      jarvisDecideCommandEl.classList.add('jarvis-hq-decide-command--critical');
      return;
    }
    if (pendingCommit) {
      ciLiveInsight.classList.add('jarvis-live-intake-result--pending');
      jarvisDecideCommandEl.classList.add('jarvis-hq-decide-command--pending');
      return;
    }
    if (taPaste.value.trim()) {
      ciLiveInsight.classList.add('jarvis-live-intake-result--processing');
      jarvisDecideCommandEl.classList.add('jarvis-hq-decide-command--processing');
    }
  };

  const syncNucleoFromProcessResult = (processResult, previewQueEntro) => {
    try {
      const interp = interpretProcessResult(processResult, unified);
      almaInterpretCtx.lastInterp = interp;
      almaInterpretCtx.lastRawEvent = {
        at: new Date().toISOString(),
        fuente: 'pegado_hq',
        canalSalida: processResult?.classification?.canalSalida || processResult?.classification?.canal,
        clienteDetectado: interp?.cliente_detectado,
      };
      ciLiveInsight.classList.remove('jarvis-live-intake-result--empty');
      const qe =
        (previewQueEntro && String(previewQueEntro).trim()) ||
        String(interp.que_entro || '').trim() ||
        String(processResult?.classification?.excerpt || processResult?.name || '').trim();
      vExecCliente.textContent = nzInsight(interp.cliente_detectado);
      vExecProblema.textContent = nzInsight(interp.jarvis_detecto || qe);
      vExecAccion.textContent = formatExecAccionLine(interp);
      vExecImpacto.textContent = formatExecImpacto(interp, processResult, null);
      buildLiveActionButtons(processResult?.classification || {});
      applyNucleoVitality(interp);
    } catch (e) {
      console.warn('[HNF] syncNucleoFromProcessResult', e);
    }
  };

  const syncLiveInsightFromOperativeEvent = (ev) => {
    if (!ev) return;
    try {
      const interp = interpretOperativeEvent(ev);
      almaInterpretCtx.lastInterp = interp;
      almaInterpretCtx.lastRawEvent = ev;
      ciLiveInsight.classList.remove('jarvis-live-intake-result--empty');
      vExecCliente.textContent = nzInsight(interp.cliente_detectado);
      vExecProblema.textContent = nzInsight(interp.jarvis_detecto || interp.que_entro);
      vExecAccion.textContent = formatExecAccionLine(interp);
      vExecImpacto.textContent = formatExecImpacto(interp, null, ev);
      buildLiveActionButtons(classificationForButtonsFromEvent(ev));
      applyNucleoVitality(interp);
      refreshAlmaOperativaUi();
    } catch (e) {
      console.warn('[HNF] syncLiveInsightFromOperativeEvent', e);
    }
  };

  const fillLiveInsight = (c, previewQueEntro) => {
    const pr = { kind: 'texto', name: 'pegado', classification: c };
    syncNucleoFromProcessResult(pr, previewQueEntro);
  };

  const clearLiveInsight = () => {
    almaInterpretCtx.lastInterp = null;
    almaInterpretCtx.lastRawEvent = null;
    applyNucleoVitality(null);
    ciLiveInsight.classList.add('jarvis-live-intake-result--empty');
    liveSub.textContent =
      'Misma lectura que JARVIS DECIDE y el alma operativa — escribí abajo para ver el flujo en vivo (sin guiones vacíos).';
    for (const v of [vExecCliente, vExecProblema, vExecAccion, vExecImpacto]) {
      v.textContent = 'requiere validación';
    }
    liveActs.innerHTML = '';
    refreshAlmaOperativaUi();
  };

  const ciStatus = document.createElement('div');
  ciStatus.className = 'jarvis-cc-centro-ingesta__status';
  const updateCiStatus = () => {
    centroSnap = getCentroIngestaState();
    const lc = centroSnap.last;
    ciStatus.innerHTML = '';
    const p1 = document.createElement('p');
    const s1 = document.createElement('strong');
    s1.textContent = 'Última ingesta (local): ';
    p1.append(
      s1,
      document.createTextNode(
        lc
          ? `${fmtAt(lc.at)} · ${lc.persistencia === 'servidor' ? 'servidor' : 'local'} · ${lc.prioridad || '—'} · ${lc.tipoClasificado || lc.tipoSalida || lc.tipo || '—'} · ${lc.responsableSugerido || lc.responsable || '—'} · ~$${fmtMoney((lc.impactoEconomicoHeuristico ?? lc.impactoEconomicoEstimado) || 0)}${lc.accionInmediata ? ` · paso: ${String(lc.accionInmediata).replace(/^\s*Acción:\s*/i, '').slice(0, 120)}` : ''}`
          : 'Sin eventos aún — cargá abajo.'
      )
    );
    const p2 = document.createElement('p');
    p2.className = 'muted small';
    const s2 = document.createElement('strong');
    s2.textContent = 'Última ingesta (datos cargados): ';
    p2.append(s2, document.createTextNode(feedLastIngestAt ? fmtAt(feedLastIngestAt) : '—'));
    ciStatus.append(p1, p2);
    paintIngresoResumido();
  };
  updateCiStatus();

  const ciRecv = document.createElement('p');
  ciRecv.className = 'jarvis-cc-centro-ingesta__recv-badge jarvis-uni-ingest__recv';
  ciRecv.textContent = 'Ingreso vivo · persistencia servidor + respaldo local.';

  const tabsBar = document.createElement('div');
  tabsBar.className = 'jarvis-uni-ingest__tab-bar';
  tabsBar.setAttribute('role', 'tablist');
  const panelsWrap = document.createElement('div');
  panelsWrap.className = 'jarvis-uni-ingest__panels';

  const fileDocOnly = document.createElement('input');
  fileDocOnly.type = 'file';
  fileDocOnly.multiple = true;
  fileDocOnly.accept = '.txt,.json,.csv,.md,.log,.xml,.html,text/*,application/json';
  fileDocOnly.className = 'jarvis-cc-centro-ingesta__file';
  fileDocOnly.hidden = true;
  const fileImageOnly = document.createElement('input');
  fileImageOnly.type = 'file';
  fileImageOnly.multiple = true;
  fileImageOnly.accept = 'image/*';
  fileImageOnly.className = 'jarvis-cc-centro-ingesta__file';
  fileImageOnly.hidden = true;

  const panelTexto = document.createElement('div');
  panelTexto.className = 'jarvis-uni-ingest__panel';
  panelTexto.dataset.panel = 'texto';
  panelTexto.setAttribute('role', 'tabpanel');
  const hintTexto = document.createElement('p');
  hintTexto.className = 'jarvis-uni-ingest__panel-hint';
  hintTexto.textContent = 'Pegá aquí correo, mensaje, nota, observación o contexto operativo.';
  const taPaste = document.createElement('textarea');
  taPaste.className = 'jarvis-cc-centro-ingesta__textarea jarvis-uni-ingest__textarea';
  taPaste.rows = jarvisStructuralClean ? 3 : 5;
  taPaste.placeholder = 'Texto libre, export o nota — sin necesidad de JSON para trabajar.';
  panelTexto.append(hintTexto, taPaste);

  const panelArchivo = document.createElement('div');
  panelArchivo.className = 'jarvis-uni-ingest__panel';
  panelArchivo.dataset.panel = 'archivo';
  panelArchivo.hidden = true;
  panelArchivo.setAttribute('role', 'tabpanel');
  const hintArch = document.createElement('p');
  hintArch.className = 'jarvis-uni-ingest__panel-hint';
  hintArch.textContent = 'Subí planilla, export, documento o lote (varios archivos). Arrastrá al área o elegí archivos.';
  const btnArchivo = document.createElement('button');
  btnArchivo.type = 'button';
  btnArchivo.className = 'secondary-button jarvis-cc-btn-touch jarvis-uni-ingest__panel-btn';
  btnArchivo.textContent = 'Elegir archivos / lote';
  btnArchivo.addEventListener('click', () => fileDocOnly.click());
  const drop = document.createElement('div');
  drop.className = 'jarvis-cc-centro-ingesta__drop jarvis-uni-ingest__drop';
  drop.textContent = 'Zona de lote — soltá aquí documentos o mezcla (luego Analizar valida cada ítem).';
  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, prevent));
  drop.addEventListener('dragover', () => drop.classList.add('jarvis-cc-centro-ingesta__drop--hover'));
  drop.addEventListener('dragleave', () => drop.classList.remove('jarvis-cc-centro-ingesta__drop--hover'));

  panelArchivo.append(hintArch, btnArchivo, drop);

  const panelImagen = document.createElement('div');
  panelImagen.className = 'jarvis-uni-ingest__panel';
  panelImagen.dataset.panel = 'imagen';
  panelImagen.hidden = true;
  panelImagen.setAttribute('role', 'tabpanel');
  const hintImg = document.createElement('p');
  hintImg.className = 'jarvis-uni-ingest__panel-hint';
  hintImg.textContent = 'Subí foto de equipo, tablero, falla, evidencia de obra o documento escaneado.';
  const btnImagen = document.createElement('button');
  btnImagen.type = 'button';
  btnImagen.className = 'secondary-button jarvis-cc-btn-touch jarvis-uni-ingest__panel-btn';
  btnImagen.textContent = 'Elegir imágenes';
  btnImagen.addEventListener('click', () => fileImageOnly.click());
  panelImagen.append(hintImg, btnImagen);

  const panelCanales = document.createElement('div');
  panelCanales.className = 'jarvis-uni-ingest__panel';
  panelCanales.dataset.panel = 'canales';
  panelCanales.hidden = true;
  panelCanales.setAttribute('role', 'tabpanel');
  const canalesBody = document.createElement('div');
  canalesBody.className = 'jarvis-uni-ingest__canales';
  canalesBody.innerHTML = `<p class="jarvis-uni-ingest__panel-hint">Correo, WhatsApp y OT ya <strong>recibidos</strong> en el sistema (clasificación y lectura — sin envío).</p>
    <ul class="jarvis-uni-ingest__canales-stats muted small">
      <li>Outlook en vista: <strong>${outlookN}</strong> mensajes</li>
      <li>WhatsApp trazado: <strong>${waN}</strong></li>
      <li>OT en plan: <strong>${planOtsN}</strong></li>
    </ul>`;
  const btnSyncFeed = document.createElement('button');
  btnSyncFeed.type = 'button';
  btnSyncFeed.className = 'primary-button jarvis-cc-btn-touch jarvis-uni-ingest__panel-btn';
  btnSyncFeed.textContent = 'Sincronizar entradas y datos';
  btnSyncFeed.addEventListener('click', () => refresh());
  const btnHub = document.createElement('button');
  btnHub.type = 'button';
  btnHub.className = 'secondary-button jarvis-cc-btn-touch jarvis-uni-ingest__panel-btn';
  btnHub.textContent = 'Abrir Intake Hub (tabla + histórico)';
  btnHub.addEventListener('click', () => intelNavigate?.({ view: 'jarvis-intake' }));
  panelCanales.append(canalesBody, btnSyncFeed, btnHub);

  const setTab = (id) => {
    for (const b of tabsBar.querySelectorAll('.jarvis-uni-ingest__tab')) {
      const on = b.dataset.tab === id;
      b.classList.toggle('jarvis-uni-ingest__tab--active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const p of panelsWrap.querySelectorAll('.jarvis-uni-ingest__panel')) {
      const on = p.dataset.panel === id;
      p.hidden = !on;
      p.classList.toggle('jarvis-uni-ingest__panel--active', on);
    }
  };
  const mkTabBtn = (id, label, hint) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'jarvis-uni-ingest__tab';
    b.dataset.tab = id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', id === 'texto' ? 'true' : 'false');
    const lb = document.createElement('span');
    lb.className = 'jarvis-uni-ingest__tab-label';
    lb.textContent = label;
    const hi = document.createElement('span');
    hi.className = 'jarvis-uni-ingest__tab-hint muted small';
    hi.textContent = hint;
    b.append(lb, hi);
    b.addEventListener('click', () => setTab(id));
    return b;
  };
  tabsBar.append(
    mkTabBtn('texto', 'Texto / correo / nota', 'Pegar'),
    mkTabBtn('archivo', 'Archivo / documento', 'Lote'),
    mkTabBtn('imagen', 'Imagen / evidencia', 'Foto'),
    mkTabBtn('canales', 'WhatsApp / OT', 'Recibidos')
  );
  panelsWrap.append(panelTexto, panelArchivo, panelImagen, panelCanales);
  setTab('texto');

  const actionsMain = document.createElement('div');
  actionsMain.className = 'jarvis-uni-ingest__main-actions';
  const btnAnalizar = document.createElement('button');
  btnAnalizar.type = 'button';
  btnAnalizar.id = 'hnf-btn-centro-clasificar';
  btnAnalizar.className = 'primary-button jarvis-cc-btn-touch jarvis-uni-ingest__btn-analizar';
  btnAnalizar.textContent = 'Clasificar';
  const btnConfirmJarvis = document.createElement('button');
  btnConfirmJarvis.type = 'button';
  btnConfirmJarvis.id = 'hnf-btn-centro-registrar';
  btnConfirmJarvis.className = 'primary-button jarvis-cc-btn-touch jarvis-uni-ingest__btn-commit';
  btnConfirmJarvis.textContent = 'Registrar';
  btnConfirmJarvis.disabled = true;
  const btnClearStage = document.createElement('button');
  btnClearStage.type = 'button';
  btnClearStage.id = 'hnf-btn-centro-limpiar';
  btnClearStage.className = 'secondary-button jarvis-cc-btn-touch';
  btnClearStage.textContent = 'Limpiar';
  btnClearStage.disabled = true;
  const ingestExecExtra = document.createElement('div');
  ingestExecExtra.className = 'jarvis-uni-ingest__exec-bar-extra';
  const btnClasificar = document.createElement('button');
  btnClasificar.type = 'button';
  btnClasificar.className = 'secondary-button jarvis-cc-btn-touch';
  btnClasificar.textContent = 'Clasificar';
  btnClasificar.addEventListener('click', () => btnAnalizar.click());
  const btnDistribuir = document.createElement('button');
  btnDistribuir.type = 'button';
  btnDistribuir.className = 'secondary-button jarvis-cc-btn-touch';
  btnDistribuir.textContent = 'Distribuir';
  btnDistribuir.addEventListener('click', () => intelNavigate?.({ view: 'jarvis-intake' }));
  ingestExecExtra.append(btnClasificar, btnDistribuir);

  const ciPreview = document.createElement('div');
  ciPreview.className = 'jarvis-cc-centro-ingesta__preview jarvis-uni-ingest__preview';
  ciPreview.setAttribute('aria-live', 'polite');

  const ciUnderstandWrap = document.createElement('div');
  ciUnderstandWrap.className = 'jarvis-uni-ingest__understand';
  const understandH = document.createElement('h3');
  understandH.className = 'jarvis-uni-ingest__block-title';
  understandH.textContent = 'Interpretación completa (entrada · detección · área · prioridad · responsable · acción)';
  const ciUnderstand = document.createElement('div');
  ciUnderstand.className = 'jarvis-uni-ingest__understand-inner';
  ciUnderstandWrap.append(understandH, ciUnderstand);

  const ciProposalWrap = document.createElement('div');
  ciProposalWrap.className = 'jarvis-uni-ingest__proposal hnf-jarvis-proposal';
  const proposalH = document.createElement('h3');
  proposalH.className = 'jarvis-uni-ingest__block-title';
  proposalH.textContent = 'Decisión en curso — confirmación humana';
  const pLead = document.createElement('p');
  pLead.className = 'hnf-jarvis-proposal__lead muted small';
  pLead.textContent =
    'Prioridad: qué hacer, quién y cuánto pesa en caja. Arriba: bloque JARVIS DECIDE. Ejecutar aplica la navegación sugerida.';
  const pPropuesta = document.createElement('p');
  pPropuesta.className = 'hnf-jarvis-proposal__block';
  const kProp = document.createElement('strong');
  kProp.className = 'hnf-jarvis-proposal__k';
  kProp.textContent = 'Propuesta Jarvis';
  pPropuesta.append(kProp, document.createTextNode(' '));
  const vPropuesta = document.createElement('span');
  vPropuesta.className = 'hnf-jarvis-proposal__v';
  pPropuesta.append(vPropuesta);
  const pAccion = document.createElement('p');
  pAccion.className = 'hnf-jarvis-proposal__block';
  const kAcc = document.createElement('strong');
  kAcc.className = 'hnf-jarvis-proposal__k';
  kAcc.textContent = 'ACCIÓN RECOMENDADA';
  pAccion.append(kAcc, document.createTextNode(' '));
  const vAccion = document.createElement('span');
  vAccion.className = 'hnf-jarvis-proposal__v';
  pAccion.append(vAccion);
  const pMotivo = document.createElement('p');
  pMotivo.className = 'hnf-jarvis-proposal__block hnf-jarvis-proposal__block--motivo';
  const kMot = document.createElement('strong');
  kMot.className = 'hnf-jarvis-proposal__k';
  kMot.textContent = 'Motivo';
  pMotivo.append(kMot, document.createTextNode(' '));
  const vMotivo = document.createElement('span');
  vMotivo.className = 'hnf-jarvis-proposal__v';
  pMotivo.append(vMotivo);
  const adnCliente = document.createElement('p');
  adnCliente.className = 'muted small hnf-jarvis-proposal__adn-meta';
  const oppBanner = document.createElement('div');
  oppBanner.className = 'hnf-jarvis-proposal__opp';
  oppBanner.hidden = true;
  const oppH = document.createElement('p');
  oppH.className = 'hnf-jarvis-proposal__opp-title';
  oppH.textContent = 'Oportunidad detectada';
  const oppLine = document.createElement('p');
  oppLine.className = 'muted small hnf-jarvis-proposal__opp-line';
  oppBanner.append(oppH, oppLine);
  const proposalBtns = document.createElement('div');
  proposalBtns.className = 'hnf-jarvis-proposal__actions';
  const btnEjecutarPropuesta = document.createElement('button');
  btnEjecutarPropuesta.type = 'button';
  btnEjecutarPropuesta.className = 'primary-button jarvis-cc-btn-touch hnf-jarvis-proposal__btn-exec';
  btnEjecutarPropuesta.textContent = 'Ejecutar propuesta';
  const btnModificarPropuesta = document.createElement('button');
  btnModificarPropuesta.type = 'button';
  btnModificarPropuesta.className = 'secondary-button jarvis-cc-btn-touch';
  btnModificarPropuesta.textContent = 'Modificar';
  const btnDescartarPropuesta = document.createElement('button');
  btnDescartarPropuesta.type = 'button';
  btnDescartarPropuesta.className = 'secondary-button jarvis-cc-btn-touch';
  btnDescartarPropuesta.textContent = 'Descartar';
  const btnGenerarPropuestaComercial = document.createElement('button');
  btnGenerarPropuestaComercial.type = 'button';
  btnGenerarPropuestaComercial.className = 'secondary-button jarvis-cc-btn-touch hnf-jarvis-proposal__btn-opp';
  btnGenerarPropuestaComercial.textContent = 'Generar propuesta';
  btnGenerarPropuestaComercial.hidden = true;
  proposalBtns.append(
    btnEjecutarPropuesta,
    btnModificarPropuesta,
    btnDescartarPropuesta,
    btnGenerarPropuestaComercial
  );
  const autonomiaHint = document.createElement('p');
  autonomiaHint.className = 'muted small hnf-jarvis-proposal__autonomia';
  ciProposalWrap.append(
    proposalH,
    pLead,
    pPropuesta,
    pAccion,
    pMotivo,
    adnCliente,
    oppBanner,
    ...(jarvisStructuralClean ? [] : [proposalBtns]),
    autonomiaHint
  );

  let activeProposalPack = buildJarvisIdleProposalPack();
  let proposalShownAt = Date.now();
  const proposalCtx = () => ({
    jarvisEvents: Array.isArray(data?.jarvisOperativeEvents) ? data.jarvisOperativeEvents : [],
  });

  paintJarvisDecide = () => {
    const pack = activeProposalPack;
    const evs = data?.jarvisOperativeEvents || [];
    let m;
    if (pack?.id !== 'jpr-idle' && pack?.accionObligatoria) {
      const pesos = Number(pack.impactoReferenciaPesos) || 0;
      const adn = pack.enlacesADN || {};
      m = {
        accion: pack.accionObligatoria,
        responsable: pack.responsableAsignado || 'Romina',
        impactoPesos: pesos,
        impactoLinea:
          pesos > 0
            ? `~$${Math.round(pesos).toLocaleString('es-CL')} · ${String(adn.impactoCaja || '').slice(0, 72)}`
            : String(adn.impactoCaja || '—'),
        queEntro: adn.cliente ? `Contexto: ${adn.cliente}` : '',
        detecto: String(pack.motivo || '').slice(0, 160),
        area: adn.area || '—',
        prioridad: String(adn.prioridadLectura || pack.prioridad || 'media'),
        impactoEstado: adn.impactoEstado,
        impactoFlujo: adn.impactoFlujo,
      };
    } else if (evs.length > 0) {
      m = buildJarvisDecideCommandModel(data, friction);
    } else {
      const adn = pack?.enlacesADN || {};
      const pesos = Number(pack?.impactoReferenciaPesos) || 95_000;
      m = {
        accion: pack.accionObligatoria,
        responsable: pack.responsableAsignado || 'Romina',
        impactoPesos: pesos,
        impactoLinea: `~$${Math.round(pesos).toLocaleString('es-CL')}`,
        queEntro: String(adn.cliente || ''),
        detecto: 'Sin cola en servidor — registrar primera entrada.',
        area: adn.area || 'Operación',
        prioridad: 'media',
        impactoEstado: adn.impactoEstado,
        impactoFlujo: adn.impactoFlujo,
      };
    }
    jdAccionText.textContent = m.accion || 'Observá el flujo central y registrá lo que falte.';
    const impactoTxt =
      typeof m.impactoPesos === 'number' && m.impactoPesos > 0
        ? `~$${Math.round(m.impactoPesos).toLocaleString('es-CL')}`
        : m.impactoLinea || '—';
    jdImpactStrong.textContent = impactoTxt;
    const presionBits = [m.impactoEstado, m.impactoFlujo].filter(Boolean).map((x) => String(x).slice(0, 120));
    jdPresSpan.textContent = presionBits.length
      ? `Presión: ${presionBits.join(' · ')}`
      : 'Presión: sin alerta crítica explícita';
    jdRespSpan.textContent = `Responsable: ${m.responsable}`;
    jdFoot.textContent = [
      m.queEntro && `${m.queEntro}`.slice(0, 180),
      m.detecto && `Jarvis detectó: ${m.detecto}`.slice(0, 220),
      m.area && `Área: ${m.area}`,
      m.prioridad && `Prioridad: ${m.prioridad}`,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const applyProposalPack = (pack, opts = {}) => {
    const { skipAutonomy = false } = opts;
    activeProposalPack = pack;
    proposalShownAt = Date.now();
    vPropuesta.textContent = pack.propuesta;
    vAccion.textContent = pack.accionObligatoria || pack.accionSugerida;
    vMotivo.textContent = pack.motivo;
    const adn = pack.enlacesADN || {};
    adnCliente.textContent = [
      adn.cliente && `Cliente: ${adn.cliente}`,
      adn.area && `Área: ${adn.area}`,
      adn.prioridadLectura && `Prioridad: ${adn.prioridadLectura}`,
      adn.ubicacion && adn.ubicacion !== '—' && `Ubicación: ${adn.ubicacion}`,
      adn.estado && `Estado: ${adn.estado}`,
      adn.impactoCaja && `Caja: ${String(adn.impactoCaja).slice(0, 72)}`,
      adn.impactoCierre && `Cierre: ${String(adn.impactoCierre).slice(0, 72)}`,
      adn.impactoComercial && `Comercial: ${String(adn.impactoComercial).slice(0, 72)}`,
      adn.impactoEstado && `Estado flujo: ${String(adn.impactoEstado).slice(0, 64)}`,
    ]
      .filter(Boolean)
      .join(' · ');
    oppBanner.hidden = !pack.oportunidadDetectada;
    oppLine.textContent = pack.propuestaComercialLine || 'Revisá contrato, visita o mantención según historial del cliente.';
    btnGenerarPropuestaComercial.hidden = !pack.oportunidadDetectada;
    btnEjecutarPropuesta.disabled = !pack.execute?.view || pack.id === 'jpr-idle';
    paintJarvisDecide();
    refreshAlmaOperativaUi();
    paintExecAdnVision();
    paintIngresoResumido();
    autonomiaHint.textContent = getJarvisAutonomiaEjecucion()
      ? 'Autonomía de ejecución: activa — acciones de riesgo bajo pueden correr sin clic.'
      : 'Autonomía de ejecución: desactivada — toda acción requiere “Ejecutar propuesta”.';

    if (
      !skipAutonomy &&
      getJarvisAutonomiaEjecucion() &&
      pack.riesgoEjecucion === 'bajo' &&
      pack.execute?.view &&
      pack.id !== 'jpr-idle'
    ) {
      appendJarvisProposalDecision({
        proposalId: pack.id,
        propuesta: pack.propuesta,
        accionSugerida: pack.accionSugerida,
        motivo: pack.motivo,
        decision: 'ejecutar',
        msToDecide: 0,
        outcome: 'autonomia_bajo_riesgo',
        clienteContext: pack.clienteContext,
      });
      rememberJarvisAction(
        `Autonomía (bajo riesgo): ${pack.execute.label || pack.execute.view}`,
        'tomada',
        'jarvis_proposal_autonomia'
      );
      intelNavigate?.({ view: pack.execute.view, ...(pack.execute.intel || {}) });
    }
  };

  const refreshProposalFromClassified = (classification, rawText, kind = 'texto') => {
    const ev = buildSyntheticOperativeEventFromClassification(classification, rawText, kind);
    applyProposalPack(buildJarvisProposalPack(ev, proposalCtx()));
  };

  const pushDraftLiveToUnifiedState = (raw) => {
    const c = classifyIntakePayload(raw);
    const pr = { kind: 'texto', name: 'pegado', classification: c };
    const previewLine = raw.replace(/\s+/g, ' ').slice(0, 400);
    syncNucleoFromProcessResult(pr, previewLine);
    refreshProposalFromClassified(c, raw.slice(0, 2000), 'texto');
  };

  nucleoIngestBridge.onSelectEntry = (it) => {
    let pr;
    if (it?.classificationSnapshot && typeof it.classificationSnapshot === 'object') {
      pr = { kind: 'texto', name: 'entrada_viva', classification: it.classificationSnapshot };
    } else {
      const raw = [it?.resumen, it?.interpretacion].filter(Boolean).join('\n');
      const cx = classifyIntakePayload(raw || 'entrada memoria viva');
      pr = { kind: 'texto', name: 'entrada_viva', classification: cx };
    }
    renderExecutiveIngestUnderstand(ciUnderstand, pr, unified, buildInboundInterpretationPipeline(pr, unified));
    scrollToCentroIngesta();
  };

  btnEjecutarPropuesta.addEventListener('click', () => {
    const pack = activeProposalPack;
    if (!pack?.execute?.view || pack.id === 'jpr-idle') return;
    appendJarvisProposalDecision({
      proposalId: pack.id,
      propuesta: pack.propuesta,
      accionSugerida: pack.accionSugerida,
      motivo: pack.motivo,
      decision: 'ejecutar',
      msToDecide: Date.now() - proposalShownAt,
      clienteContext: pack.clienteContext,
    });
    rememberJarvisAction(
      pack.execute.label || `Ejecutar: ${pack.execute.view}`,
      'tomada',
      'jarvis_proposal_ejecutar'
    );
    intelNavigate?.({ view: pack.execute.view, ...(pack.execute.intel || {}) });
  });

  btnModificarPropuesta.addEventListener('click', () => {
    const pack = activeProposalPack;
    appendJarvisProposalDecision({
      proposalId: pack.id,
      propuesta: pack.propuesta,
      accionSugerida: pack.accionSugerida,
      motivo: pack.motivo,
      decision: 'modificar',
      msToDecide: Date.now() - proposalShownAt,
      clienteContext: pack.clienteContext,
    });
    rememberJarvisAction('Propuesta Jarvis — usuario modifica en ingreso', 'tomada', 'jarvis_proposal_modificar');
    taPaste.focus();
    scrollToCentroIngesta();
  });

  btnDescartarPropuesta.addEventListener('click', () => {
    const pack = activeProposalPack;
    appendJarvisProposalDecision({
      proposalId: pack.id,
      propuesta: pack.propuesta,
      accionSugerida: pack.accionSugerida,
      motivo: pack.motivo,
      decision: 'descartar',
      msToDecide: Date.now() - proposalShownAt,
      clienteContext: pack.clienteContext,
    });
    rememberJarvisAction('Propuesta Jarvis descartada', 'tomada', 'jarvis_proposal_descartar');
    applyProposalPack(buildJarvisIdleProposalPack(), { skipAutonomy: true });
  });

  btnGenerarPropuestaComercial.addEventListener('click', () => {
    const pack = activeProposalPack;
    const cli = String(pack.clienteContext || '').trim();
    appendJarvisProposalDecision({
      proposalId: pack.id,
      propuesta: pack.propuesta,
      accionSugerida: 'Generar propuesta comercial',
      motivo: pack.motivo,
      decision: 'ejecutar',
      msToDecide: Date.now() - proposalShownAt,
      outcome: 'generar_propuesta_comercial',
      clienteContext: pack.clienteContext,
    });
    rememberJarvisAction('Oportunidad — generar propuesta', 'tomada', 'jarvis_proposal_comercial');
    intelNavigate?.({
      view: 'oportunidades',
      ...(cli ? { commercial: { mode: 'list', filterCliente: cli } } : {}),
    });
  });

  const ciSalidaWrap = document.createElement('div');
  ciSalidaWrap.className = 'jarvis-uni-ingest__salida';
  const salidaH = document.createElement('h3');
  salidaH.className = 'jarvis-uni-ingest__block-title';
  salidaH.textContent = 'Salida ejecutiva';
  const ciSalida = document.createElement('div');
  ciSalida.className = 'jarvis-uni-ingest__salida-inner';
  const salidaLead = document.createElement('p');
  salidaLead.className = 'jarvis-uni-ingest__salida-lead muted small';
  salidaLead.textContent = 'Tipo · prioridad · cliente · riesgo · oportunidad · responsable · acción · destino.';
  ciSalidaWrap.append(salidaH, salidaLead, ciSalida);

  const ciTech = document.createElement('details');
  ciTech.className = 'jarvis-uni-ingest__technical';
  const ciTechSum = document.createElement('summary');
  ciTechSum.textContent = 'Modo avanzado · ingesta técnica (JSON, export, lote histórico)';
  const taTech = document.createElement('textarea');
  taTech.className = 'jarvis-cc-centro-ingesta__textarea jarvis-uni-ingest__textarea';
  taTech.rows = 4;
  taTech.placeholder = 'Pegá JSON o export crudo; se copia a pestaña TEXTO y podés Analizar → Confirmar.';
  const btnTech = document.createElement('button');
  btnTech.type = 'button';
  btnTech.className = 'secondary-button jarvis-cc-btn-touch';
  btnTech.textContent = 'Enviar a analizador de texto';
  const ciOutPre = document.createElement('pre');
  ciOutPre.className = 'jarvis-uni-ingest__technical-pre muted small';
  ciOutPre.textContent = '';
  ciTech.append(ciTechSum, taTech, btnTech, ciOutPre);

  /** @type {File[]} */
  let stagedFiles = [];
  /** @type {string[]} */
  const stagedObjectUrls = [];
  /** @type {string[]} */
  const visualThumbUrls = [];

  const clearUnderstandVisuals = () => {
    for (const u of visualThumbUrls) URL.revokeObjectURL(u);
    visualThumbUrls.length = 0;
    ciUnderstand.innerHTML = '';
    applyProposalPack(buildJarvisIdleProposalPack(), { skipAutonomy: true });
  };

  let pendingCommit = null;

  const invalidatePending = () => {
    pendingCommit = null;
    btnConfirmJarvis.disabled = true;
    ciOutPre.textContent = '';
  };

  let draftLiveTimer = 0;
  taPaste.addEventListener('input', () => {
    invalidatePending();
    window.clearTimeout(draftLiveTimer);
    draftLiveTimer = window.setTimeout(() => {
      const raw = taPaste.value.trim();
      if (!raw) {
        clearLiveInsight();
        return;
      }
      pushDraftLiveToUnifiedState(raw);
    }, 90);
  });

  refreshAlmaOperativaUi = () => {
    try {
      const rawDraft = taPaste.value.trim();
      const hasDraft = rawDraft.length > 0;
      const hasFiles = stagedFiles.length > 0;
      const proposalActive = activeProposalPack?.id !== 'jpr-idle';
      const phases = computeJarvisAlmaPhases({
        hasDraftText: hasDraft,
        hasStagedFiles: hasFiles,
        hasPendingCommit: !!pendingCommit,
        proposalActive,
        recentlyRegistered: Date.now() < almaRegisteredUntil,
      });
      phases.forEach((ph, i) => {
        const el = almaPhaseEls[i];
        if (!el) return;
        el.classList.remove(
          'jarvis-alma-spine__node--activo',
          'jarvis-alma-spine__node--pendiente',
          'jarvis-alma-spine__node--resuelto',
        );
        el.classList.add(`jarvis-alma-spine__node--${ph.estado}`);
      });

      const ch = listChannels().find((x) => x.id === getSelectedIntakeChannelId());
      const tr = buildJarvisTraceabilityModel({
        interp: almaInterpretCtx.lastInterp,
        rawEvent: almaInterpretCtx.lastRawEvent,
        canalLabel: ch?.channel_name || 'manual',
      });
      if (hasDraft && !almaInterpretCtx.lastRawEvent?.at) {
        tr.hora = new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'medium' });
      }
      traceFlow.textContent = [
        `Origen · ${tr.origen}  ·  Hora · ${tr.hora}`,
        `Cliente · ${tr.cliente}  ·  Responsable · ${tr.responsable}`,
        `Estado · ${tr.estadoActual}`,
        `Siguiente paso · ${tr.siguientePaso}`,
      ].join('\n');

      const mapa = computeMapaOperativoHoy(data?.jarvisOperativeEvents, result?.planOts);
      mapaBar.textContent = `Ingresos hoy: ${mapa.ingresos} | En proceso: ${mapa.enProceso} | Críticos: ${mapa.detenidos} | Sin dueño: ${mapa.sinDueno} | Cerrados: ${mapa.cerrados}`;
      paintIngresoResumido();
    } catch (e) {
      console.warn('[HNF] refreshAlmaOperativaUi', e);
    }
  };

  refreshAlmaOperativaUi();

  const syncStageButtons = () => {
    btnClearStage.disabled = stagedFiles.length === 0;
    refreshAlmaOperativaUi();
  };

  const pulseIngestFlowComplete = () => {
    centroIngesta.setAttribute('data-hnf-adn-sync', '1');
    refreshAlmaOperativaUi();
    window.setTimeout(() => centroIngesta.removeAttribute('data-hnf-adn-sync'), 1400);
  };

  const clearStage = (opts = {}) => {
    const { keepUnderstand = false } = opts;
    invalidatePending();
    if (!keepUnderstand) clearUnderstandVisuals();
    clearLiveInsight();
    ciSalida.innerHTML = '';
    for (const u of stagedObjectUrls) URL.revokeObjectURL(u);
    stagedObjectUrls.length = 0;
    stagedFiles = [];
    ciPreview.innerHTML = '';
    ciPreview.classList.remove('jarvis-cc-centro-ingesta__preview--active');
    syncStageButtons();
  };

  const syncUnderstandFromLastCentroEvent = () => {
    const lastEv = getCentroIngestaState().last;
    if (lastEv && ciUnderstand?.isConnected) {
      renderJarvisExecutiveUnderstandFromEvent(ciUnderstand, lastEv);
      applyProposalPack(buildJarvisProposalPack(lastEv, proposalCtx()), { skipAutonomy: true });
      syncLiveInsightFromOperativeEvent(lastEv);
    }
  };

  const renderStage = async () => {
    invalidatePending();
    clearUnderstandVisuals();
    ciSalida.innerHTML = '';
    for (const u of stagedObjectUrls) URL.revokeObjectURL(u);
    stagedObjectUrls.length = 0;
    ciPreview.innerHTML = '';
    if (!stagedFiles.length) {
      ciPreview.classList.remove('jarvis-cc-centro-ingesta__preview--active');
      syncStageButtons();
      return;
    }
    ciPreview.classList.add('jarvis-cc-centro-ingesta__preview--active');
    const prevTitle = document.createElement('div');
    prevTitle.className = 'jarvis-cc-centro-ingesta__preview-title';
    prevTitle.textContent = '6 · Vista previa inteligente — revisá antes de confirmar a Jarvis';
    ciPreview.append(prevTitle);
    for (const f of stagedFiles) {
      const row = document.createElement('div');
      row.className = 'jarvis-cc-centro-ingesta__preview-row';
      const meta = document.createElement('div');
      meta.className = 'jarvis-cc-centro-ingesta__preview-meta';
      const type = f.type || '';
      meta.textContent = `${f.name} · ${type || 'archivo'}`;
      row.append(meta);
      if (type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        stagedObjectUrls.push(url);
        const img = document.createElement('img');
        img.className = 'jarvis-cc-centro-ingesta__preview-thumb';
        img.src = url;
        img.alt = `Preview ${f.name}`;
        row.append(img);
      }
      const sum = document.createElement('div');
      sum.className = 'jarvis-cc-centro-ingesta__preview-sum';
      if (type.startsWith('image/')) {
        sum.textContent = 'Imagen · Analizar para lectura, riesgo y acción sugerida.';
      } else if (type.startsWith('text/') || /\.(txt|json|csv|md|log)$/i.test(f.name)) {
        let raw = '';
        try {
          raw = await f.slice(0, 8000).text();
        } catch {
          raw = '';
        }
        const c = classifyIntakePayload(raw);
        sum.textContent = `Canal ${c.canalSalida || c.canal || '—'} · Dueño ${c.responsable || '—'} · Urgencia ${c.urgencia || '—'} · Riesgo ${c.generaRiesgo ? 'sí' : 'no'} · Opp ${c.generaOportunidad ? 'sí' : 'no'}`;
        const syn = document.createElement('div');
        syn.className = 'jarvis-cc-centro-ingesta__preview-syn muted small';
        const ex = (c.excerpt || raw || '').replace(/\s+/g, ' ').slice(0, 160);
        syn.textContent = ex ? `Síntesis: ${ex}${ex.length >= 160 ? '…' : ''}` : 'Sin síntesis extraíble.';
        row.append(sum, syn);
        ciPreview.append(row);
        continue;
      } else {
        sum.textContent = 'Tipo no legible como texto aquí · Analizar para clasificación.';
      }
      row.append(sum);
      ciPreview.append(row);
    }
    syncStageButtons();
  };

  const stageFiles = async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    stagedFiles = stagedFiles.concat(list);
    await renderStage();
  };

  const getActiveTab = () =>
    tabsBar.querySelector('.jarvis-uni-ingest__tab--active')?.dataset.tab || 'texto';

  const renderPipelineInto = (container, pipeline) => {
    container.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'jarvis-pipeline';
    const pt = document.createElement('div');
    pt.className = 'jarvis-pipeline__head';
    pt.textContent = 'Entrada → tipo → riesgo → oportunidad comercial → acción → destino';
    track.append(pt);
    for (const paso of pipeline?.pasos || []) {
      const card = document.createElement('div');
      card.className = `jarvis-pipeline__step jarvis-pipeline__step--${paso.estado || 'ok'}`;
      const nEl = document.createElement('span');
      nEl.className = 'jarvis-pipeline__n';
      nEl.textContent = String(paso.n);
      const body = document.createElement('div');
      body.className = 'jarvis-pipeline__body';
      const th = document.createElement('strong');
      th.textContent = paso.titulo;
      const tp = document.createElement('p');
      tp.textContent = paso.cuerpo;
      body.append(th, tp);
      card.append(nEl, body);
      track.append(card);
    }
    container.append(track);
  };

  const renderExecutiveIngestUnderstand = (container, processResult, unified, pipeline) => {
    container.innerHTML = '';
    const stack = document.createElement('div');
    stack.className = 'jarvis-uni-ingest__understand-stack';
    const execMount = document.createElement('div');
    renderJarvisExecutiveUnderstand(execMount, processResult, unified);
    const det = document.createElement('details');
    det.className = 'jarvis-uni-ingest__pipeline-details';
    const sum = document.createElement('summary');
    sum.className = 'jarvis-uni-ingest__pipeline-sum';
    sum.textContent = 'Cadena de interpretación (detalle)';
    const pipeMount = document.createElement('div');
    renderPipelineInto(pipeMount, pipeline);
    det.append(sum, pipeMount);
    stack.append(execMount, det);
    container.append(stack);
    const c = processResult?.classification;
    const previewLine = String(
      c?.excerpt || processResult?.name || taPaste?.value?.trim() || ''
    )
      .replace(/\s+/g, ' ')
      .slice(0, 220);
    syncNucleoFromProcessResult(processResult, previewLine);
    if (c) {
      const rawText = String(c.excerpt || processResult?.name || '').slice(0, 2000);
      const kind = processResult?.kind === 'imagen' ? 'imagen' : 'texto';
      refreshProposalFromClassified(c, rawText, kind);
    }
  };

  const renderFileBatchUnderstand = (container, results, unified) => {
    container.innerHTML = '';
    const primary = results.find((r) => r.classification) || results[0];
    if (!primary) return;
    const stack = document.createElement('div');
    stack.className = 'jarvis-uni-ingest__understand-stack';
    const execMount = document.createElement('div');
    renderJarvisExecutiveUnderstand(execMount, primary, unified);
    stack.append(execMount);
    if (results.length > 1) {
      const note = document.createElement('p');
      note.className = 'muted small jarvis-uni-ingest__batch-note';
      note.textContent = `Lote de ${results.length} ítems — resumen del ítem principal; detalle desplegable abajo.`;
      stack.append(note);
    }
    const det = document.createElement('details');
    det.className = 'jarvis-uni-ingest__pipeline-details';
    const sum = document.createElement('summary');
    sum.className = 'jarvis-uni-ingest__pipeline-sum';
    sum.textContent = results.length > 1 ? `Detalle por ítem (${results.length})` : 'Cadena de interpretación (detalle)';
    det.append(sum);
    for (const r of results) {
      const hdr = document.createElement('h4');
      hdr.className = 'jarvis-uni-ingest__entry-h';
      hdr.textContent = `${String(r.kind || 'item').toUpperCase()} — ${r.name || '—'}`;
      det.append(hdr);
      if (r.kind === 'imagen' && r.imageIntel) {
        const inner = document.createElement('div');
        const img = r.imageIntel;
        renderPipelineInto(inner, img.interpretacionPipeline || buildJarvisInterpretationPipeline(img));
        det.append(inner);
      } else {
        const inner = document.createElement('div');
        renderPipelineInto(inner, buildInboundInterpretationPipeline(r, unified));
        det.append(inner);
      }
    }
    container.append(stack, det);
    const pv = String(
      primary?.classification?.excerpt || primary?.name || primary?.imageIntel?.resumenEjecutivo || ''
    )
      .replace(/\s+/g, ' ')
      .slice(0, 220);
    syncNucleoFromProcessResult(primary, pv);
    if (primary?.classification) {
      refreshProposalFromClassified(
        primary.classification,
        String(primary.classification.excerpt || primary.name || '').slice(0, 2000),
        primary.kind === 'imagen' ? 'imagen' : 'texto'
      );
    }
  };

  const renderVisualBlock = (mount, r) => {
    const img = r.imageIntel;
    if (!img) return;
    const art = document.createElement('article');
    art.className = 'jarvis-visual-jarvis';
    const h = document.createElement('h4');
    h.className = 'jarvis-visual-jarvis__h';
    h.textContent = `Análisis visual Jarvis — ${r.name || 'imagen'}`;
    art.append(h);
    const f = stagedFiles.find((x) => x.name === r.name && (x.type || '').startsWith('image/'));
    if (f) {
      const u = URL.createObjectURL(f);
      visualThumbUrls.push(u);
      const thumb = document.createElement('img');
      thumb.className = 'jarvis-visual-jarvis__thumb';
      thumb.src = u;
      thumb.alt = '';
      art.append(thumb);
    }
    const dl = document.createElement('dl');
    dl.className = 'jarvis-visual-jarvis__dl';
    const addRow = (dt, dd) => {
      const dtt = document.createElement('dt');
      dtt.textContent = dt;
      const ddd = document.createElement('dd');
      ddd.textContent = dd;
      dl.append(dtt, ddd);
    };
    addRow('IMAGEN DETECTADA — Tipo', img.tipoImagenEjecutivo || '—');
    addRow('Lectura', img.descripcionVisual || img.interpretacionTecnica || '—');
    addRow('Riesgo técnico', String(img.riesgoTecnicoNivel || img.riesgoTecnico || '—'));
    addRow('Oportunidad comercial', `${img.oportunidadTipoEjecutivo || '—'} — ${img.oportunidadComercial || '—'}`);
    addRow('Urgencia', String(img.urgencia || '—'));
    addRow('Impacto probable (estim.)', `~$${fmtMoney(img.impactoProbable)}`);
    addRow('Acción recomendada', img.accionSugerida || img.accionRecomendada || '—');
    addRow('Destino sugerido', img.destinoSugerido || '—');
    art.append(dl);
    if (img.lecturaParcial) {
      const note = document.createElement('p');
      note.className = 'jarvis-visual-jarvis__partial';
      note.textContent = img.requiereContextoAdicional || 'Lectura parcial — se requiere contexto adicional.';
      art.append(note);
    }
    const execMount = document.createElement('div');
    execMount.className = 'jarvis-uni-ingest__understand-stack jarvis-visual-jarvis__exec';
    renderJarvisExecutiveUnderstand(execMount, r, unified);
    art.append(execMount);
    const detPipe = document.createElement('details');
    detPipe.className = 'jarvis-uni-ingest__pipeline-details';
    const sumPipe = document.createElement('summary');
    sumPipe.className = 'jarvis-uni-ingest__pipeline-sum';
    sumPipe.textContent = 'Cadena de interpretación (detalle)';
    const pipeHost = document.createElement('div');
    renderPipelineInto(pipeHost, img.interpretacionPipeline || buildJarvisInterpretationPipeline(img));
    detPipe.append(sumPipe, pipeHost);
    art.append(detPipe);
    mount.append(art);
    const pvImg = String(
      r.classification?.excerpt || r.imageIntel?.resumenEjecutivo || r.name || ''
    )
      .replace(/\s+/g, ' ')
      .slice(0, 220);
    syncNucleoFromProcessResult(r, pvImg);
    if (r.classification) {
      refreshProposalFromClassified(
        r.classification,
        String(r.classification.excerpt || r.name || '').slice(0, 2000),
        'imagen'
      );
    } else {
      const synth = [
        img.resumenEjecutivo,
        img.descripcionVisual,
        img.accionSugerida,
        r.name,
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 2000);
      const fakeC = classifyIntakePayload(synth || 'ingesta imagen');
      refreshProposalFromClassified(fakeC, synth || 'ingesta imagen', 'imagen');
    }
  };

  const renderSalida = (el, sal) => {
    el.innerHTML = '';
    const voz = document.createElement('div');
    voz.className = 'jarvis-salida-jarvis__voz';
    for (const line of sal.voz || []) {
      const p = document.createElement('p');
      p.textContent = line;
      voz.append(p);
    }
    const ul = document.createElement('ul');
    ul.className = 'jarvis-salida-jarvis__bullets';
    const b = sal.bullets || {};
    const items = [
      `Canal de salida: ${b.canalSalida}`,
      `Tipo de salida: ${b.tipoSalida}`,
      `Riesgo: ${b.riesgoGenerado}`,
      `Oportunidad: ${b.oportunidadGenerada}`,
      `Acción inmediata: ${b.accionInmediata}`,
      `Guardado local: ${b.guardadoLocal}`,
      `Integrado a HQ / feed / memoria: ${b.integrado}`,
    ];
    for (const t of items) {
      const li = document.createElement('li');
      li.textContent = t;
      ul.append(li);
    }
    el.append(voz, ul);
  };

  const commitIngestResults = async (results) => {
    if (!results?.length) return;
    appendMemoryEvent('ingesta_archivos', { n: results.length, archivos: results.map((r) => r.name) });
    for (const r of results) {
      await persistJarvisOperativeIngest(
        r.classification,
        {
          kind: r.kind,
          archivo: r.name,
          rawText: r.classification?.excerpt || r.name,
          fuente: 'archivos_hq',
        },
        (payload) => jarvisOperativeEventsService.append(payload)
      );
      interpretTextForChannel(
        r.classification?.excerpt || r.name,
        getSelectedIntakeChannelId(),
        { persistTerreno: true, appendFlujo: true }
      );
      executeIntakeThroughActionPipeline(r.classification, { archivo: r.name });
      rememberInboundMeaning(buildInboundMeaning(r, unified));
    }
    updateCiStatus();
    for (const r of results) {
      const c = r.classification;
      appendLiveIntakeEntry({
        tipo: c?.tipoSalida || c?.tipo || r.kind || '—',
        resumen: String(c?.excerpt || r.name || '').slice(0, 200),
        interpretacion: detectLabel(c),
        responsable: String(c?.responsable || '—'),
        estado: 'ingresado',
        accion_tomada: 'Ingresar al sistema (archivo/imagen)',
        classificationSnapshot: c || null,
      });
    }
    refreshLiveEntries();
    try {
      const slim = results.map((r) => ({
        kind: r.kind,
        name: r.name,
        classification: r.classification,
        imageIntel: r.imageIntel
          ? {
              tipoImagenEjecutivo: r.imageIntel.tipoImagenEjecutivo,
              resumenEjecutivo: r.imageIntel.resumenEjecutivo,
              riesgoTecnicoNivel: r.imageIntel.riesgoTecnicoNivel,
            }
          : undefined,
      }));
      ciOutPre.textContent = JSON.stringify(slim, null, 2).slice(0, 8000);
    } catch {
      ciOutPre.textContent = '';
    }
  };

  btnTech.addEventListener('click', () => {
    taPaste.value = taTech.value;
    setTab('texto');
    btnAnalizar.click();
  });

  const commitPendingIngest = async () => {
    if (!pendingCommit) return;
    if (pendingCommit.kind === 'text') {
      const c = pendingCommit.classification;
      appendMemoryEvent('ingesta_texto', { canal: c.canalSalida || c.canal, tipo: c.tipoSalida || c.tipo });
      await persistJarvisOperativeIngest(
        c,
        { rawText: pendingCommit.raw, fuente: 'pegado_hq', archivo: 'pegado_hq' },
        (payload) => jarvisOperativeEventsService.append(payload)
      );
      interpretTextForChannel(pendingCommit.raw, getSelectedIntakeChannelId(), {
        persistTerreno: true,
        appendFlujo: true,
      });
      executeIntakeThroughActionPipeline(c, { archivo: 'pegado_hq' });
      rememberInboundMeaning(buildInboundMeaning({ kind: 'texto', name: 'pegado', classification: c }, unified));
      updateCiStatus();
      appendLiveIntakeEntry({
        tipo: c?.tipoSalida || c?.tipo || 'texto',
        resumen: String(pendingCommit.raw || '').replace(/\s+/g, ' ').slice(0, 200),
        interpretacion: detectLabel(c),
        responsable: String(c?.responsable || '—'),
        estado: 'ingresado',
        accion_tomada: 'Ingresar al sistema (texto)',
        classificationSnapshot: c || null,
      });
      refreshLiveEntries();
      const salCommitted = buildIntakeSalidaJarvis({ textClassification: c, committed: true });
      almaRegisteredUntil = Date.now() + 2400;
      taPaste.value = '';
      clearStage({ keepUnderstand: true });
      syncUnderstandFromLastCentroEvent();
      pulseIngestFlowComplete();
      renderSalida(ciSalida, salCommitted);
      await refresh();
      refreshAlmaOperativaUi();
      return;
    }
    if (pendingCommit.kind === 'files') {
      const batch = pendingCommit.results;
      await commitIngestResults(batch);
      const salCommitted = buildIntakeSalidaJarvis({ results: batch, committed: true });
      almaRegisteredUntil = Date.now() + 2400;
      clearStage({ keepUnderstand: true });
      syncUnderstandFromLastCentroEvent();
      pulseIngestFlowComplete();
      renderSalida(ciSalida, salCommitted);
      await refresh();
      refreshAlmaOperativaUi();
    }
  };

  const runAnalizarEIngresarAlSistema = async () => {
    const tab = getActiveTab();
    if (tab === 'canales') {
      setTab('texto');
    }
    const tabNow = getActiveTab();
    clearUnderstandVisuals();
    clearLiveInsight();
    ciSalida.innerHTML = '';
    if (tabNow === 'texto') {
      const raw = taPaste.value.trim();
      if (!raw) {
        const p = document.createElement('p');
        p.className = 'jarvis-uni-ingest__warn';
        p.textContent = 'Pegá texto (cliente, OT, correo o WhatsApp) y volvé a intentar.';
        ciSalida.append(p);
        return;
      }
      const c = classifyIntakePayload(raw);
      const dec = buildJarvisDecisionEngine({ text: raw });
      pendingCommit = { kind: 'text', classification: c, raw };
      const pr = { kind: 'texto', name: 'pegado', classification: c };
      renderExecutiveIngestUnderstand(ciUnderstand, pr, unified, buildInboundInterpretationPipeline(pr, unified));
      renderSalida(ciSalida, buildIntakeSalidaJarvis({ textClassification: c, committed: false }));
      try {
        ciOutPre.textContent = JSON.stringify(
          { version: 'hnf-jarvis-ingest-1', decisionEngine: dec, clasificacion: c },
          null,
          2
        ).slice(0, 8000);
      } catch {
        ciOutPre.textContent = '';
      }
      btnConfirmJarvis.disabled = false;
      await commitPendingIngest();
      return;
    }
    if (!stagedFiles.length) {
      const p = document.createElement('p');
      p.className = 'jarvis-uni-ingest__warn';
      p.textContent = 'Agregá archivos o imágenes al lote, o usá pestaña Texto.';
      ciSalida.append(p);
      return;
    }
    if (tabNow === 'imagen') {
      const nonImg = stagedFiles.some((f) => !(f.type || '').startsWith('image/'));
      if (nonImg) {
        const msg = document.createElement('p');
        msg.className = 'jarvis-uni-ingest__warn';
        msg.textContent = 'En Imagen solo fotos. Usá Archivo para documentos.';
        ciSalida.append(msg);
        return;
      }
    }
    btnAnalizar.disabled = true;
    const results = await processIntakeFiles(stagedFiles);
    btnAnalizar.disabled = false;
    pendingCommit = { kind: 'files', results };
    if (results.length === 1 && results[0].kind === 'imagen' && results[0].imageIntel) {
      renderVisualBlock(ciUnderstand, results[0]);
    } else if (results.length === 1) {
      renderExecutiveIngestUnderstand(
        ciUnderstand,
        results[0],
        unified,
        buildInboundInterpretationPipeline(results[0], unified)
      );
    } else {
      renderFileBatchUnderstand(ciUnderstand, results, unified);
    }
    renderSalida(ciSalida, buildIntakeSalidaJarvis({ results, committed: false }));
    try {
      const decisions = results.map((r) =>
        buildJarvisDecisionEngine({ text: r.classification?.excerpt || r.name || '' })
      );
      const slim = results.map((r, i) => ({
        kind: r.kind,
        name: r.name,
        decisionEngine: decisions[i],
        classification: r.classification,
        imageIntel: r.imageIntel
          ? {
              resumenEjecutivo: r.imageIntel.resumenEjecutivo,
              tipoImagenEjecutivo: r.imageIntel.tipoImagenEjecutivo,
            }
          : undefined,
      }));
      ciOutPre.textContent = JSON.stringify({ version: 'hnf-jarvis-ingest-1', items: slim }, null, 2).slice(0, 8000);
    } catch {
      ciOutPre.textContent = '';
    }
    btnConfirmJarvis.disabled = false;
    await commitPendingIngest();
  };

  const btnComboIngest = document.createElement('button');
  btnComboIngest.type = 'button';
  btnComboIngest.id = 'hnf-btn-jarvis-combo-ingest';
  btnComboIngest.className = 'primary-button jarvis-cc-btn-touch jarvis-uni-ingest__btn-combo';
  btnComboIngest.textContent = 'Clasificar e ingresar';
  btnComboIngest.addEventListener('click', () => runAnalizarEIngresarAlSistema());

  actionsMain.append(btnComboIngest, btnAnalizar, btnConfirmJarvis, btnClearStage);

  btnAnalizar.addEventListener('click', async () => {
    const tab = getActiveTab();
    if (tab === 'canales') {
      ciSalida.textContent =
        'Elegí TEXTO, ARCHIVO o IMAGEN para analizar una carga nueva. CANALES muestra lo ya recibido — usá Sincronizar o Intake Hub.';
      return;
    }
    clearUnderstandVisuals();
    clearLiveInsight();
    ciSalida.innerHTML = '';
    if (tab === 'texto') {
      const raw = taPaste.value.trim();
      if (!raw) {
        renderSalida(ciSalida, buildIntakeSalidaJarvis({}));
        return;
      }
      const c = classifyIntakePayload(raw);
      pendingCommit = { kind: 'text', classification: c, raw };
      const pr = { kind: 'texto', name: 'pegado', classification: c };
      renderExecutiveIngestUnderstand(ciUnderstand, pr, unified, buildInboundInterpretationPipeline(pr, unified));
      renderSalida(ciSalida, buildIntakeSalidaJarvis({ textClassification: c, committed: false }));
      try {
        ciOutPre.textContent = JSON.stringify(c, null, 2).slice(0, 6000);
      } catch {
        ciOutPre.textContent = '';
      }
      btnConfirmJarvis.disabled = false;
      return;
    }
    if (!stagedFiles.length) {
      const msg = document.createElement('p');
      msg.className = 'muted small';
      msg.textContent =
        tab === 'imagen'
          ? 'Seleccioná o arrastrá imágenes (pestaña Imagen).'
          : 'Agregá archivos al lote o soltalos en el área de carga.';
      ciSalida.append(msg);
      return;
    }
    if (tab === 'imagen') {
      const nonImg = stagedFiles.some((f) => !(f.type || '').startsWith('image/'));
      if (nonImg) {
        const msg = document.createElement('p');
        msg.className = 'jarvis-uni-ingest__warn';
        msg.textContent =
          'En Imagen solo deben quedar fotos. Sacá documentos del lote o usá pestaña Archivo.';
        ciSalida.append(msg);
        return;
      }
    }
    btnAnalizar.disabled = true;
    const results = await processIntakeFiles(stagedFiles);
    btnAnalizar.disabled = false;
    pendingCommit = { kind: 'files', results };
    if (results.length === 1 && results[0].kind === 'imagen' && results[0].imageIntel) {
      renderVisualBlock(ciUnderstand, results[0]);
    } else if (results.length === 1) {
      renderExecutiveIngestUnderstand(
        ciUnderstand,
        results[0],
        unified,
        buildInboundInterpretationPipeline(results[0], unified)
      );
    } else {
      renderFileBatchUnderstand(ciUnderstand, results, unified);
    }
    renderSalida(ciSalida, buildIntakeSalidaJarvis({ results, committed: false }));
    try {
      const slim = results.map((r) => ({
        kind: r.kind,
        name: r.name,
        classification: r.classification,
        imageIntel: r.imageIntel
          ? {
              resumenEjecutivo: r.imageIntel.resumenEjecutivo,
              tipoImagenEjecutivo: r.imageIntel.tipoImagenEjecutivo,
            }
          : undefined,
      }));
      ciOutPre.textContent = JSON.stringify(slim, null, 2).slice(0, 8000);
    } catch {
      ciOutPre.textContent = '';
    }
    btnConfirmJarvis.disabled = false;
  });

  btnConfirmJarvis.addEventListener('click', () => commitPendingIngest());

  btnClearStage.addEventListener('click', () => clearStage());

  drop.addEventListener('drop', (e) => {
    drop.classList.remove('jarvis-cc-centro-ingesta__drop--hover');
    stageFiles(e.dataTransfer?.files);
  });
  fileDocOnly.addEventListener('change', () => {
    stageFiles(fileDocOnly.files);
    fileDocOnly.value = '';
  });
  fileImageOnly.addEventListener('change', () => {
    stageFiles(fileImageOnly.files);
    fileImageOnly.value = '';
  });

  const autoSec = document.createElement('div');
  autoSec.className = 'jarvis-cc-centro-ingesta__panel';
  const autoH = document.createElement('h3');
  autoH.className = 'jarvis-cc-centro-ingesta__h3';
  autoH.textContent = 'Autoalimentación (vacíos críticos)';
  const autoLegend = document.createElement('p');
  autoLegend.className = 'jarvis-cc-centro-ingesta__auto-legend muted small';
  autoLegend.textContent = '⚠ Sistema incompleto · ⚡ Acción requerida';
  const autoUl = document.createElement('ul');
  autoUl.className = 'jarvis-cc-centro-ingesta__ul';
  for (const item of liveBrain.autoalimentacion || []) {
    const li = document.createElement('li');
    li.className = 'jarvis-cc-centro-ingesta__auto-rich';
    const head = document.createElement('div');
    head.className = 'jarvis-cc-centro-ingesta__auto-head';
    const vacioFuerte = /sin |vacío|ausente|no hay/i.test(String(item.mensajeCorto || item.vacio || ''));
    head.textContent = `${vacioFuerte ? '⚠ ' : '⚡ '}${item.mensajeCorto || item.vacio || '—'}`;
    const body = document.createElement('div');
    body.className = 'muted small jarvis-cc-centro-ingesta__auto-body';
    body.textContent = [
      item.vacio && `Vacío: ${item.vacio}`,
      item.impactoSiNo && `Impacto si no: ${item.impactoSiNo}`,
      item.accion && `Acción: ${item.accion}`,
    ]
      .filter(Boolean)
      .join('\n');
    li.append(head, body);
    autoUl.append(li);
  }
  autoSec.append(autoH, autoLegend, autoUl);

  const supSec = document.createElement('div');
  supSec.className = 'jarvis-cc-centro-ingesta__panel';
  const supH = document.createElement('h3');
  supH.className = 'jarvis-cc-centro-ingesta__h3';
  supH.textContent = 'Supervisión total — alertas inteligentes';
  const supUl = document.createElement('ul');
  supUl.className = 'jarvis-cc-centro-ingesta__ul';
  for (const al of superAlerts) {
    const li = document.createElement('li');
    li.className = `jarvis-cc-centro-ingesta__alert jarvis-cc-centro-ingesta__alert--${al.severidad || 'info'}`;
    li.textContent = al.detalle ? `${al.titulo} — ${al.detalle}` : al.titulo;
    supUl.append(li);
  }
  supSec.append(supH, supUl);

  const expSec = document.createElement('div');
  expSec.className = 'jarvis-cc-centro-ingesta__panel';
  const expH = document.createElement('h3');
  expH.className = 'jarvis-cc-centro-ingesta__h3';
  expH.textContent = 'Motor de expansión — acciones';
  const expUl = document.createElement('ul');
  expUl.className = 'jarvis-cc-centro-ingesta__ul';
  for (const line of expansionLines) {
    const li = document.createElement('li');
    li.textContent = line;
    expUl.append(li);
  }
  expSec.append(expH, expUl);

  const expansionRadar = unified.jarvisExpansionRadar || { lineas: [] };
  const radSec = document.createElement('div');
  radSec.className = 'jarvis-cc-centro-ingesta__panel';
  const radH = document.createElement('h3');
  radH.className = 'jarvis-cc-centro-ingesta__h3';
  radH.textContent = 'Radar de expansión (preparado)';
  const radUl = document.createElement('ul');
  radUl.className = 'jarvis-cc-centro-ingesta__ul';
  for (const line of expansionRadar.lineas || []) {
    const li = document.createElement('li');
    li.textContent = line;
    radUl.append(li);
  }
  radSec.append(radH, radUl);

  const detOps = document.createElement('details');
  detOps.className = 'jarvis-uni-ingest__details-ops';
  const detOpsSum = document.createElement('summary');
  detOpsSum.textContent = 'Paneles operativos (autoalimentación, alertas, expansión, radar)';
  detOps.append(detOpsSum, autoSec, supSec, expSec, radSec);

  if (jarvisStructuralClean) {
    btnEjecutarPropuesta.textContent = 'Ejecutar';
    understandH.textContent = 'Interpretación completa';
    proposalH.textContent = 'Decisión Jarvis';
    pLead.hidden = true;
    ciHead.classList.add('jarvis-hq-centro-head--clean');

    const capa2Resumen = document.createElement('div');
    capa2Resumen.className = 'jarvis-mando-ingreso-resumen jarvis-mando-capa2-operacion tarjeta';

    const opCard = document.createElement('div');
    opCard.className = 'jarvis-mando-op-card';
    const lineTarea = document.createElement('p');
    lineTarea.className = 'jarvis-mando-op-card__line jarvis-mando-op-card__line--tarea';
    const lineRespOp = document.createElement('p');
    lineRespOp.className = 'jarvis-mando-op-card__line muted small';
    const linePrioridad = document.createElement('p');
    linePrioridad.className = 'jarvis-mando-op-card__line jarvis-mando-op-card__line--prio';
    const lineSenal = document.createElement('p');
    lineSenal.className = 'jarvis-mando-op-card__line muted small';
    opCard.append(lineTarea, lineRespOp, linePrioridad, lineSenal);

    const primRow = document.createElement('div');
    primRow.className = 'jarvis-mando-ingreso-resumen__prim jarvis-mando-ingreso-resumen__prim--solo-ejecutar';

    const btnVerDetalleOperativo = document.createElement('button');
    btnVerDetalleOperativo.type = 'button';
    btnVerDetalleOperativo.className = 'secondary-button jarvis-cc-btn-touch';
    btnVerDetalleOperativo.textContent = 'Ver detalle operativo';

    const btnIrModuloSugerido = document.createElement('button');
    btnIrModuloSugerido.type = 'button';
    btnIrModuloSugerido.className = 'secondary-button jarvis-cc-btn-touch';
    btnIrModuloSugerido.textContent = 'Ir al módulo sugerido';

    const masAccionesFold = document.createElement('details');
    masAccionesFold.className = 'jarvis-mando-mas-acciones';
    const masSum = document.createElement('summary');
    masSum.className = 'jarvis-mando-mas-acciones__sum';
    masSum.textContent = 'Más acciones';
    const masBody = document.createElement('div');
    masBody.className = 'jarvis-mando-mas-acciones__body';
    masBody.append(
      btnVerDetalleOperativo,
      btnIrModuloSugerido,
      btnModificarPropuesta,
      btnDescartarPropuesta,
      btnGenerarPropuestaComercial,
      btnClasificar,
      btnDistribuir,
    );
    masAccionesFold.append(masSum, masBody);

    primRow.append(btnEjecutarPropuesta);
    capa2Resumen.append(ciHead, opCard, primRow, masAccionesFold);

    const ingresarInfoFold = document.createElement('details');
    ingresarInfoFold.className = 'jarvis-hq-ingreso-evidencia-fold tarjeta';
    const ingresarSum = document.createElement('summary');
    ingresarSum.className = 'jarvis-hq-ingreso-evidencia-fold__sum';
    ingresarSum.textContent = 'Ingresar información / evidencia';
    const ingresarBody = document.createElement('div');
    ingresarBody.className = 'jarvis-hq-ingreso-evidencia-fold__body';
    ingresarBody.append(chBar, tabsBar, panelsWrap, actionsMain, ciPreview);
    ingresarInfoFold.append(ingresarSum, ingresarBody);

    const detalleTecnicoFold = document.createElement('details');
    detalleTecnicoFold.className = 'jarvis-hq-detalle-tecnico-fold tarjeta';
    const detalleSum = document.createElement('summary');
    detalleSum.className = 'jarvis-hq-detalle-tecnico-fold__sum';
    detalleSum.textContent = 'Ver detalle técnico / trazabilidad';
    const detalleBody = document.createElement('div');
    detalleBody.className = 'jarvis-hq-detalle-tecnico-fold__body';
    detalleBody.append(
      ciUnderstandWrap,
      ciProposalWrap,
      autonomiaHint,
      ciSalidaWrap,
      ciFlowStrip,
      almaRoot,
      ciStatus,
      ciRecv,
      ciLiveInsight,
      liveEntriesPanel,
      ciTech,
      detOps,
    );
    detalleTecnicoFold.append(detalleSum, detalleBody);

    btnVerDetalleOperativo.addEventListener('click', () => {
      detalleTecnicoFold.open = true;
      detalleTecnicoFold.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    btnIrModuloSugerido.addEventListener('click', () => {
      const pack = activeProposalPack;
      if (pack?.execute?.view && pack.id !== 'jpr-idle') {
        intelNavigate?.({ view: pack.execute.view, ...(pack.execute.intel || {}) });
        return;
      }
      const idleHint = String(liveCmdModel?.mandatoryAction || '').toLowerCase();
      if (/whatsapp|wa\b/.test(idleHint)) intelNavigate?.({ view: 'jarvis-intake' });
      else if (/evidencia|ot|cierre|clima/.test(idleHint)) navigateToView?.('clima');
      else navigateToView?.('operacion-control');
    });

    paintIngresoResumido = () => {
      const last = getCentroIngestaState().last;
      const pack = activeProposalPack;
      const tasks = getJarvisOperationalTasks().filter((t) => t.obligatoria);
      const topTask = tasks[0];
      lineTarea.textContent = topTask?.accion
        ? `Tarea activa: ${String(topTask.accion).replace(/\s+/g, ' ').slice(0, 120)}`
        : pack?.id !== 'jpr-idle' && pack?.accionObligatoria
          ? `Tarea activa: ${String(pack.accionObligatoria).replace(/\s+/g, ' ').slice(0, 120)}`
          : 'Tarea activa: — (abrí ingreso o detalle si necesitás cargar señal)';
      const resp =
        topTask?.responsable ||
        pack?.responsableAsignado ||
        last?.responsableSugerido ||
        last?.responsable ||
        '—';
      lineRespOp.textContent = `Responsable: ${resp}`;
      const prio =
        topTask?.urgencia ||
        pack?.prioridad ||
        (pack?.enlacesADN?.prioridadLectura ? String(pack.enlacesADN.prioridadLectura) : null) ||
        'media';
      linePrioridad.textContent = `Prioridad: ${prio}`;
      let senal = '—';
      if (last) {
        senal = `${fmtAt(last.at)} · ${String(last.tipoClasificado || last.tipoSalida || last.tipo || '—')
          .replace(/\s+/g, ' ')
          .slice(0, 88)}`;
      } else if (liveDigest.items?.[0]) {
        const it = liveDigest.items[0];
        senal = `${fmtAt(it.at)} · ${String(it.significa || it.queEntro || '—')
          .replace(/\s+/g, ' ')
          .slice(0, 88)}`;
      }
      lineSenal.textContent = `Última señal: ${senal}`;
    };

    centroIngesta.append(capa2Resumen, ingresarInfoFold, detalleTecnicoFold);
    paintIngresoResumido();
  } else {
    centroIngesta.append(
      ciHead,
      ciFlowStrip,
      almaRoot,
      ciStatus,
      ciRecv,
      ciLiveInsight,
      liveEntriesPanel,
      tabsBar,
      panelsWrap,
      actionsMain,
      ingestExecExtra,
      ciPreview,
      ciUnderstandWrap,
      ciProposalWrap,
      ciSalidaWrap,
      ciTech,
      detOps,
    );
  }
  refreshLiveEntries();
  {
    const lastInit = getCentroIngestaState().last;
    const serverEv = (() => {
      const arr = Array.isArray(data?.jarvisOperativeEvents) ? data.jarvisOperativeEvents : [];
      if (!arr.length) return null;
      const sorted = [...arr].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      return sorted[0] || null;
    })();
    const seedEv = lastInit || serverEv;
    if (seedEv) {
      renderJarvisExecutiveUnderstandFromEvent(ciUnderstand, seedEv);
      applyProposalPack(buildJarvisProposalPack(seedEv, proposalCtx()), { skipAutonomy: true });
      syncLiveInsightFromOperativeEvent(seedEv);
    } else {
      applyProposalPack(buildJarvisIdleProposalPack(), { skipAutonomy: true });
    }
  }
  stagePrimary.append(centroIngesta);
  appendJarvisSecondaryPanel(solJarvis);

  const hoySec = document.createElement('section');
  hoySec.className = 'jarvis-cc-hoy-hnf tarjeta';
  const hoyTitle = document.createElement('h2');
  hoyTitle.className = 'jarvis-cc-hoy-hnf__title';
  hoyTitle.textContent = '🔥 HOY EN HNF';
  const hoyGrid = document.createElement('div');
  hoyGrid.className = 'jarvis-cc-hoy-hnf__grid';
  const mkHoyRow = (label, val) => {
    const row = document.createElement('div');
    row.className = 'jarvis-cc-hoy-hnf__row';
    const lb = document.createElement('div');
    lb.className = 'jarvis-cc-hoy-hnf__label';
    lb.textContent = label;
    const v = document.createElement('div');
    v.className = 'jarvis-cc-hoy-hnf__value';
    v.textContent = val == null || val === '' ? '—' : String(val);
    row.append(lb, v);
    return row;
  };
  const he = operator.hoyEnHnf || {};
  hoyGrid.append(
    mkHoyRow('Acción crítica', he.accionCritica),
    mkHoyRow('Dinero en juego', he.dineroEnJuego),
    mkHoyRow('Oportunidad del día', he.oportunidadDelDia),
    mkHoyRow('Riesgo oculto', he.riesgoOculto)
  );
  const hoyMoney = document.createElement('p');
  hoyMoney.className = 'jarvis-cc-hoy-hnf__money muted small';
  hoyMoney.textContent = `Dinero bloqueado (estimado/inferido): $${fmtMoney(operator?.money?.ingresoBloqueado)} · Fuga: $${fmtMoney(operator?.money?.fugaDinero)}`;
  hoySec.append(hoyTitle, hoyGrid, hoyMoney);
  appendJarvisSecondaryPanel(hoySec);

  if (operator.jarvisDataMode === 'inferencial' && operator.inferenciaMensaje) {
    const inf = document.createElement('div');
    inf.className = 'jarvis-cc-inferencia-banner tarjeta estado-oportunidad';
    inf.textContent = operator.inferenciaMensaje;
    appendJarvisSecondaryPanel(inf);
  }

  const alienOs = document.createElement('section');
  alienOs.className = 'jarvis-alien-os tarjeta';
  const alienTitle = document.createElement('h3');
  alienTitle.className = 'jarvis-alien-os__title';
  alienTitle.textContent = 'Órbitas ejecutivas — detalle';
  const alienLayout = document.createElement('div');
  alienLayout.className = 'jarvis-alien-os__layout';

  const nucWrap = document.createElement('div');
  nucWrap.className = 'jarvis-alien-os__nucleus-wrap';
  const core = document.createElement('div');
  const pulseInt = Number(alienCore.meta?.frictionPressureIntensidad) || 1;
  core.className = `jarvis-alien-core jarvis-alien-core--alive jarvis-alien-core--${alienCore.nucleusState} jarvis-alien-core--pulse-${pulseInt}`;
  core.dataset.estado = alienDecision.estadoGlobal || 'estable';
  core.setAttribute('aria-hidden', 'true');
  core.innerHTML = `
    <div class="jarvis-alien-core__bolt"></div>
    <div class="jarvis-alien-core__ring jarvis-alien-core__ring--1"></div>
    <div class="jarvis-alien-core__ring jarvis-alien-core__ring--2"></div>
    <div class="jarvis-alien-core__core"></div>
  `;
  const activeNodes = Math.min(
    12,
    (operator.opportunityDiscovery?.oportunidades?.length || 0) +
      Math.min(6, Array.isArray(result.commercialOpportunities) ? result.commercialOpportunities.length : 0)
  );
  const nodes = document.createElement('div');
  nodes.className = 'jarvis-alien-core__nodes';
  for (let i = 0; i < activeNodes; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'jarvis-alien-core__node';
    dot.style.setProperty('--a', `${(360 / Math.max(activeNodes, 1)) * i}deg`);
    nodes.append(dot);
  }
  core.append(nodes);

  const nucCap = document.createElement('p');
  nucCap.className = 'jarvis-alien-os__nucleus-caption';
  nucCap.textContent = alienCore.nucleusLabel;

  const energy = document.createElement('div');
  energy.className = 'jarvis-alien-os__energy';
  const blocked = Math.min(100, (alienCore.orbitas.dinero.ingresoBloqueado / 800_000) * 100);
  const flowPct = alienCore.nucleusState === 'critico' ? 22 : alienCore.nucleusState === 'presion' ? 55 : 88;
  energy.innerHTML = `<div class="jarvis-alien-os__energy-label">Flujo de energía (dinero)</div>
    <div class="jarvis-alien-os__energy-bar"><span class="jarvis-alien-os__energy-fill jarvis-alien-os__energy-fill--blocked" style="width:${blocked}%"></span></div>
    <div class="jarvis-alien-os__energy-bar jarvis-alien-os__energy-bar--flow"><span class="jarvis-alien-os__energy-fill jarvis-alien-os__energy-fill--flow" style="width:${flowPct}%"></span></div>`;

  const pulseAlerts = document.createElement('div');
  pulseAlerts.className = `jarvis-alien-os__pulses ${alienCore.erroresSistema.filter((e) => e.severidad === 'critical').length ? 'jarvis-alien-os__pulses--alert' : ''}`;
  pulseAlerts.textContent =
    alienCore.erroresSistema.length > 0
      ? `${alienCore.erroresSistema.length} pulso(s) de alerta en órbita`
      : 'Pulsos de alerta: cola controlada';

  nucWrap.append(core, nucCap, energy, pulseAlerts);

  const orbits = document.createElement('div');
  orbits.className = 'jarvis-alien-os__orbits';
  const mkOrbit = (title, lines) => {
    const box = document.createElement('div');
    box.className = 'jarvis-alien-orbit tarjeta';
    const h = document.createElement('h4');
    h.className = 'jarvis-alien-orbit__title';
    h.textContent = title;
    const ul = document.createElement('ul');
    ul.className = 'jarvis-alien-orbit__list';
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.append(li);
    }
    box.append(h, ul);
    return box;
  };

  const o = alienCore.orbitas;
  orbits.append(
    mkOrbit('1 · DINERO (energía)', [
      `Ingreso proyectado hoy: $${fmtMoney(o.dinero.ingresoProyectado)}`,
      `Ingreso bloqueado: $${fmtMoney(o.dinero.ingresoBloqueado)}`,
      `Fuga por demora: $${fmtMoney(o.dinero.fugaDinero)}`,
      `Potencial mensual comercial: $${fmtMoney(o.dinero.potencialMensual)}`,
    ]),
    mkOrbit('2 · RIESGO (inestabilidad)', [
      `Operativo: ${o.riesgo.operativo}`,
      `Comercial: ${o.riesgo.comercial}`,
      o.riesgo.dependenciaPersonas,
    ]),
    mkOrbit('3 · OPORTUNIDAD (expansión)', [
      `Activos sin upsell (hint): ${o.oportunidad.clientesActivosSinUpsell}`,
      `Oportunidades sin gestión >72h: ${o.oportunidad.oportunidadesSinGestion72h}`,
      `Patrones contrato: ${o.oportunidad.serviciosRepetidosContrato}`,
      ...(o.oportunidad.zonasSinActividadHint?.length
        ? [`Zonas (hint): ${o.oportunidad.zonasSinActividadHint.join(', ')}`]
        : []),
    ]),
    mkOrbit('4 · SISTEMA (órbita de control)', [
      `Salud del núcleo: ${o.sistema.saludGeneral}/100${
        o.sistema.saludRaw != null && o.sistema.saludRaw !== o.sistema.saludGeneral
          ? ` (sensor bruto ${o.sistema.saludRaw})`
          : ''
      }`,
      o.sistema.aprendizaje,
      `Cobertura de datos (vista núcleo): ${o.sistema.coberturaDatosPct}%`,
      `Evolución: ${o.sistema.evolucion}`,
    ])
  );

  alienLayout.append(nucWrap, orbits);

  const decisionAlien = document.createElement('div');
  decisionAlien.className = 'jarvis-alien-os__decision tarjeta';
  const d = alienCore.decision;
  decisionAlien.innerHTML = `<h4 class="jarvis-alien-os__decision-title">Motor de decisión</h4>
    <p><strong>Foco:</strong> <span class="jarvis-alien-os__decision-body"></span></p>
    <p><strong>Acción inmediata:</strong> <span class="jarvis-alien-os__decision-body2"></span></p>
    <p><strong>Impacto esperado:</strong> <span class="jarvis-alien-os__decision-body3"></span></p>
    <p><strong>Urgencia real:</strong> <span class="jarvis-alien-os__decision-urg"></span></p>`;
  decisionAlien.querySelector('.jarvis-alien-os__decision-body').textContent = d.focoPrincipal;
  decisionAlien.querySelector('.jarvis-alien-os__decision-body2').textContent = d.accionInmediata;
  decisionAlien.querySelector('.jarvis-alien-os__decision-body3').textContent = d.impactoEsperado;
  decisionAlien.querySelector('.jarvis-alien-os__decision-urg').textContent = d.urgenciaReal;

  const pr = alienCore.presion || {};
  const presionTone =
    pr.nivel === 'critica'
      ? 'estado-critico'
      : pr.nivel === 'alta'
        ? 'estado-oportunidad'
        : '';
  const presionBox = document.createElement('div');
  presionBox.className = `jarvis-alien-os__presion tarjeta ${presionTone}`.trim();
  presionBox.innerHTML = `<h4 class="jarvis-alien-os__presion-title">Motor de presión</h4>
    <p class="jarvis-alien-os__presion-nivel"><strong>Nivel:</strong> <span class="jarvis-alien-os__presion-nivel-val"></span></p>
    <p class="muted small jarvis-alien-os__presion-msg"></p>
    <ul class="jarvis-alien-os__presion-list"></ul>`;
  presionBox.querySelector('.jarvis-alien-os__presion-nivel-val').textContent = String(pr.nivel || 'media');
  presionBox.querySelector('.jarvis-alien-os__presion-msg').textContent = pr.mensaje || '';
  const prUl = presionBox.querySelector('.jarvis-alien-os__presion-list');
  const leg = pr.razonesLegibles || pr.razones || [];
  for (const line of leg) {
    const li = document.createElement('li');
    li.textContent = line;
    prUl.append(li);
  }

  const oppMotor = document.createElement('div');
  oppMotor.className = 'jarvis-alien-os__opp-motor tarjeta';
  const omTitle = document.createElement('h4');
  omTitle.className = 'jarvis-alien-os__opp-motor-title';
  omTitle.textContent = 'Motor de oportunidades (automático)';
  oppMotor.append(omTitle);
  const motorItems = alienCore.orbitas?.oportunidad?.motor || [];
  if (motorItems.length) {
    for (const it of motorItems) {
      const card = document.createElement('div');
      card.className = 'jarvis-alien-os__opp-card';
      card.innerHTML = `<p class="jarvis-alien-os__opp-card-title"></p>
        <p class="muted small jarvis-alien-os__opp-card-meta"></p>
        <p class="jarvis-alien-os__opp-card-action"></p>`;
      card.querySelector('.jarvis-alien-os__opp-card-title').textContent = it.titulo || 'Oportunidad';
      card.querySelector('.jarvis-alien-os__opp-card-meta').textContent = `Valor ~$${fmtMoney(it.valorEstimado)} · P(cierre) ~${it.probabilidad ?? '—'}%`;
      card.querySelector('.jarvis-alien-os__opp-card-action').textContent = it.accion || '';
      oppMotor.append(card);
    }
  } else {
    const card = document.createElement('div');
    card.className = 'jarvis-alien-os__opp-card';
    const so0 = alienCore.salidaObligatoria || {};
    card.innerHTML = `<p class="jarvis-alien-os__opp-card-title"></p>
        <p class="muted small jarvis-alien-os__opp-card-meta"></p>
        <p class="jarvis-alien-os__opp-card-action"></p>`;
    card.querySelector('.jarvis-alien-os__opp-card-title').textContent = so0.oportunidadDetectada || 'Oportunidad proyectada por núcleo';
    card.querySelector('.jarvis-alien-os__opp-card-meta').textContent =
      'Motor activo · ítem sintético hasta que ingresen más señales comerciales';
    card.querySelector('.jarvis-alien-os__opp-card-action').textContent =
      alienCore.decision?.accionInmediata || 'Registrar oportunidades comerciales y asignar dueño hoy.';
    oppMotor.append(card);
  }

  const salida = document.createElement('div');
  salida.className = 'jarvis-alien-os__salida tarjeta estado-oportunidad';
  const so = alienCore.salidaObligatoria;
  salida.innerHTML = `<h4 class="jarvis-alien-os__salida-title">Salida obligatoria (activa)</h4>`;
  const salList = document.createElement('ul');
  salList.className = 'jarvis-alien-os__salida-list';
  for (const [k, v] of [
    ['Estado del núcleo', so.estadoNucleo],
    ['Dinero en juego', so.dineroEnJuego],
    ['Oportunidad detectada', so.oportunidadDetectada],
    ['Riesgo oculto', so.riesgoOculto],
    ['Acción inmediata', so.accionInmediata],
  ]) {
    const li = document.createElement('li');
    const b = document.createElement('strong');
    b.textContent = `${k}: `;
    li.append(b, document.createTextNode(v));
    salList.append(li);
  }
  salida.append(salList);

  const vision = document.createElement('div');
  vision.className = 'jarvis-alien-os__vision';
  const vh = document.createElement('h4');
  vh.className = 'jarvis-alien-os__vision-title';
  vh.textContent = 'Visión externa (simulada · mercado)';
  const vul = document.createElement('ul');
  vul.className = 'jarvis-alien-os__vision-list muted small';
  for (const line of alienCore.visionExterna) {
    const li = document.createElement('li');
    li.textContent = line;
    vul.append(li);
  }
  vision.append(vh, vul);

  const imgBox = document.createElement('div');
  imgBox.className = 'jarvis-alien-os__image tarjeta';
  const imgTitle = document.createElement('h4');
  imgTitle.className = 'jarvis-alien-os__image-title';
  imgTitle.textContent = 'Análisis de imagen (Jarvis)';
  const imgHint = document.createElement('p');
  imgHint.className = 'muted small';
  imgHint.textContent =
    'Sube una foto de equipo, obra o documento. Interpretación heurística local (sin API de visión).';
  const imgInput = document.createElement('input');
  imgInput.type = 'file';
  imgInput.accept = 'image/*';
  imgInput.className = 'jarvis-alien-os__image-input';
  const imgOut = document.createElement('div');
  imgOut.className = 'jarvis-alien-os__image-out';
  imgInput.addEventListener('change', async () => {
    const f = imgInput.files?.[0];
    imgOut.textContent = f ? 'Analizando…' : '';
    if (!f) return;
    const res = await analyzeJarvisImage(f);
    const appendTriple = (triple) => {
      const box = document.createElement('div');
      box.className = 'jarvis-alien-os__image-triple';
      const h = document.createElement('div');
      h.className = 'jarvis-alien-os__image-triple-title';
      h.textContent = 'Jarvis — decisión desde imagen';
      box.append(h);
      for (const [lab, val] of [
        ['REALIDAD', triple.realidad],
        ['IMPACTO', triple.impacto],
        ['ACCIÓN', triple.accion],
      ]) {
        const p = document.createElement('p');
        const s = document.createElement('strong');
        s.textContent = `${lab}: `;
        p.append(s, document.createTextNode(val));
        box.append(p);
      }
      imgOut.append(box);
    };
    if (!res) {
      imgOut.textContent = '';
      appendTriple(
        buildJarvisImageDecisionTriple({ ok: false, error: 'Archivo no válido o no es imagen.' })
      );
      return;
    }
    const triple = res.jarvisTriple || buildJarvisImageDecisionTriple(res);
    if (res.ok === false) {
      imgOut.textContent = '';
      appendTriple(triple);
      return;
    }
    imgOut.innerHTML = '';
    appendTriple(triple);
    const detalleH = document.createElement('p');
    detalleH.className = 'muted small jarvis-alien-os__image-detail-kicker';
    detalleH.textContent = 'Detalle técnico (heurístico):';
    imgOut.append(detalleH);
    const parts = [
      ['Clasificación núcleo (OT / equipo / problema / oportunidad)', res.clasificacionNucleo || res.sistema],
      ['Resumen operativo (equipo → riesgo → oportunidad)', res.resumenOperativo || '—'],
      ['Riesgo técnico', res.riesgoTecnico || '—'],
      ['Oportunidad comercial (desde imagen)', res.oportunidadComercial || '—'],
      ['Urgencia', res.urgencia || '—'],
      ['Cadena causal (Jarvis)', res.cadenaCausal || '—'],
      ['Elementos relevantes', (res.elementosRelevantes || []).join(' · ')],
      ['Interpretación técnica', res.interpretacionTecnica],
      ['Impacto económico estimado', `$${fmtMoney(res.impactoEconomicoEstimado)}`],
      ['Acción recomendada', res.accionRecomendada],
      ['Riesgo asociado', res.riesgoAsociado],
    ];
    for (const [a, b] of parts) {
      const p = document.createElement('p');
      const s = document.createElement('strong');
      s.textContent = `${a}: `;
      p.append(s, document.createTextNode(b));
      imgOut.append(p);
    }
    const meta = document.createElement('p');
    meta.className = 'muted small';
    meta.textContent = res.meta?.nota || '';
    imgOut.append(meta);
  });
  imgBox.append(imgTitle, imgHint, imgInput, imgOut);

  alienOs.append(alienTitle, alienLayout, decisionAlien, presionBox, oppMotor, salida, vision, imgBox);
  appendJarvisSecondaryPanel(alienOs);

  if (unified.jarvisFrozen) {
    const ban = document.createElement('div');
    ban.className = 'jarvis-cc-banner';
    ban.textContent =
      'Modo apagado: análisis MAPE congelado. La sección “Actividad viva” refleja datos actuales del ERP.';
    appendJarvisSecondaryPanel(ban);
  }

  const securityStrip = document.createElement('p');
  securityStrip.className = 'jarvis-cc-security muted small';
  securityStrip.textContent =
    'Seguridad: Jarvis no envía correos, no escribe en el ERP ni modifica backend productivo. Solo lectura, sugerencias y memoria local opcional.';

  const pulseBar = document.createElement('div');
  pulseBar.className = 'jarvis-cc-alien-pulse tarjeta';
  const pulseDot = document.createElement('span');
  pulseDot.className = 'jarvis-cc-alien-pulse__dot jarvis-cc-alien-pulse__dot--off';
  pulseDot.setAttribute('aria-hidden', 'true');
  const pulseCol = document.createElement('div');
  pulseCol.className = 'jarvis-cc-alien-pulse__col';
  const pulseLine1 = document.createElement('div');
  pulseLine1.className = 'jarvis-cc-alien-pulse__line1';
  const pulseLine2 = document.createElement('div');
  pulseLine2.className = 'muted small jarvis-cc-alien-pulse__line2';
  const pulseLine3 = document.createElement('div');
  pulseLine3.className = 'muted small jarvis-cc-alien-pulse__line3';
  pulseCol.append(pulseLine1, pulseLine2, pulseLine3);
  const btnPulse = document.createElement('button');
  btnPulse.type = 'button';
  btnPulse.className = 'secondary-button jarvis-cc-btn-touch jarvis-cc-alien-pulse__btn';

  const updatePulseUi = () => {
    const st = pulseSnap();
    const on = st.running;
    pulseDot.classList.toggle('jarvis-cc-alien-pulse__dot--on', on);
    pulseDot.classList.toggle('jarvis-cc-alien-pulse__dot--off', !on);
    pulseDot.classList.toggle('jarvis-cc-alien-pulse__dot--breathe', on);
    pulseLine1.textContent = on ? '● Jarvis activo' : '○ Jarvis detenido';
    const sec = st.secondsSinceLastCycle;
    pulseLine2.textContent =
      sec == null ? 'Último ciclo: —' : `Último ciclo: hace ${sec} segundos`;
    const cambio = st.operadorCambio ? 'sí' : 'no';
    const ciclo = st.operadorCicloPulse || '—';
    pulseLine3.textContent = `Pulse running: ${on ? 'sí' : 'no'} · ciclo operador: ${ciclo} · cambio detectado: ${cambio}`;
    btnPulse.textContent = on ? 'Pausar Jarvis' : 'Iniciar Jarvis';
  };

  btnPulse.addEventListener('click', () => {
    if (pulseSnap().running) stopJarvisPulse();
    else {
      startJarvisPulse({
        intervalMs: 40000,
        modeAware: true,
      });
    }
    updatePulseUi();
  });

  pulseBar.append(pulseDot, pulseCol, btnPulse);
  updatePulseUi();
  if (typeof window !== 'undefined') {
    window.__hnfPulseUiTimer = setInterval(updatePulseUi, 1000);
  }

  const jarvisDecide = document.createElement('section');
  jarvisDecide.className = 'jarvis-cc-jarvis-decide';
  jarvisDecide.innerHTML = `<h3 class="jarvis-cc-jarvis-decide__title">JARVIS DECIDE (operador)</h3>`;
  const operatorDecideGrid = document.createElement('div');
  operatorDecideGrid.className = 'jarvis-cc-jarvis-decide__grid';
  const mkJd = (label, value, extraClass) => {
    const box = document.createElement('div');
    box.className = `jarvis-cc-jarvis-decide__block tarjeta ${extraClass || ''}`;
    const lb = document.createElement('div');
    lb.className = 'jarvis-cc-jarvis-decide__label';
    lb.textContent = label;
    const val = document.createElement('div');
    val.className = 'jarvis-cc-jarvis-decide__value';
    val.textContent = value == null || value === '' ? '—' : String(value);
    box.append(lb, val);
    return box;
  };
  const jd = operator.jarvisDecide || {};
  operatorDecideGrid.append(
    mkJd('🚨 QUÉ FRENA EL NEGOCIO', jd.queFrena, operator?.risk?.valorCritico === 'alto' ? 'estado-critico' : ''),
    mkJd('💰 ACCIÓN QUE MÁS DINERO GENERA HOY', jd.accionMasDinero, 'estado-oportunidad'),
    mkJd('🙈 QUÉ IGNORAR HOY', jd.ignorar, ''),
    mkJd('⚠️ RIESGO QUE NO SE ESTÁ VIENDO', jd.riesgoOculto, 'estado-critico')
  );
  jarvisDecide.append(operatorDecideGrid);

  if (jarvisStructuralClean) legacyBulkFold.append(securityStrip, pulseBar, jarvisDecide);
  else jarvisSecondaryDeck.append(securityStrip, pulseBar, jarvisDecide);
  if (dataVacuum) {
    const vac = document.createElement('div');
    vac.className = 'jarvis-cc-data-vacuum tarjeta';
    vac.innerHTML =
      '<p><strong>Jarvis sin datos reales.</strong> Cargar información (OT / clientes / documentos) para activar inteligencia.</p>';
    appendJarvisSecondaryPanel(vac);
  }

  const moneyU = operator?.money?.urgencia || 'media';
  const riskU = operator?.risk?.valorCritico === 'alto' ? 'critico' : operator?.risk?.erroresCount > 6 ? 'alto' : 'ok';
  const oppU = (operator?.opportunity?.valorEstimado || 0) >= 400000 ? 'oportunidad' : 'ok';
  const teamU = (operator?.team?.riesgoMax || 0) >= 70 ? 'critico' : 'ok';

  const quad = document.createElement('div');
  quad.className = 'jarvis-cc-quadrants';
  const mkQ = (title, crit, txt, tone) => {
    const el = document.createElement('div');
    const toneClass =
      tone === 'critico'
        ? 'estado-critico'
        : tone === 'oportunidad'
          ? 'estado-oportunidad'
          : '';
    el.className = `jarvis-cc-quadrant tarjeta ${toneClass}`.trim();
    el.innerHTML = `<h4 class="jarvis-cc-quadrant__title">${title}</h4><p class="jarvis-cc-quadrant__crit">${crit}</p><p class="jarvis-cc-quadrant__txt muted small">${txt}</p>`;
    return el;
  };
  quad.append(
    mkQ(
      '1 · DINERO',
      `$${Math.round(operator?.money?.ingresoBloqueado || 0).toLocaleString('es-CL')} bloqueado · fuga $${Math.round(operator?.money?.fugaDinero || 0).toLocaleString('es-CL')}`,
      operator?.money?.textoCorto || '—',
      moneyU === 'critica' || moneyU === 'alta' ? 'critico' : 'ok'
    ),
    mkQ(
      '2 · RIESGO',
      String(operator?.risk?.valorCritico || '—'),
      `${operator?.risk?.texto || '—'} (${operator?.risk?.erroresCount ?? 0} hallazgos doc/correo)`,
      riskU === 'critico' || riskU === 'alto' ? 'critico' : 'ok'
    ),
    mkQ(
      '3 · OPORTUNIDAD',
      operator?.opportunity?.valorCritico || '—',
      `${operator?.opportunity?.texto || '—'} · ~${operator?.opportunity?.probabilidadCierre ?? '—'}% cierre · $${Math.round(operator?.opportunity?.valorEstimado || 0).toLocaleString('es-CL')}`,
      oppU === 'oportunidad' ? 'oportunidad' : 'ok'
    ),
    mkQ(
      '4 · EQUIPO',
      operator?.team?.valorCritico || '—',
      `${operator?.team?.texto || '—'} · ${operator?.team?.cargaResumen || ''}`,
      teamU === 'critico' ? 'critico' : 'ok'
    )
  );
  appendJarvisSecondaryPanel(quad);

  const errSec = document.createElement('section');
  errSec.className = 'jarvis-cc-errores-negocio';
  errSec.innerHTML = `<h3 class="jarvis-cc-section-title">Errores del sistema</h3>`;
  const errList = document.createElement('ul');
  errList.className = 'jarvis-cc-errores-negocio__list';
  const en = alienCore.erroresSistema?.length ? alienCore.erroresSistema : operator.erroresNegocio || [];
  if (en.length) {
    for (const e of en) {
      const li = document.createElement('li');
      li.className = `jarvis-cc-errores-negocio__item jarvis-cc-errores-negocio__item--${e.severidad || 'info'}`;
      li.textContent = `${e.titulo || e.codigo || 'Hallazgo'} — ${e.detalle || ''}`.trim();
      errList.append(li);
    }
  } else {
    const li = document.createElement('li');
    li.className = 'muted small';
    li.textContent = 'Sin hallazgos adicionales en este corte.';
    errList.append(li);
  }
  errSec.append(errList);
  appendJarvisSecondaryPanel(errSec);

  /* —— Inteligencia operativa + paneles legacy —— solo en modo Observar */
  const fi = flowIntel ?? unified.jarvisFlowIntelligence;
  const pulseSt = pulseSnap();
  const decisionLayer =
    pulseSt.running && pulseSt.jarvisDecisionLayer ? pulseSt.jarvisDecisionLayer : fi?.jarvisDecisionLayer;

  if (showLegacyDashboard) {
  const flowSec = document.createElement('section');
  flowSec.className = 'jarvis-cc-flow-intel';
  flowSec.innerHTML = `<h3 class="jarvis-cc-section-title">🔥 Inteligencia operativa</h3>`;
  const flowIntro = document.createElement('p');
  flowIntro.className = 'jarvis-cc-flow-intel__mantra muted small';
  flowIntro.textContent = fi?.mantra || 'No optimizo tareas, optimizo dinero y flujo.';
  flowSec.append(flowIntro);

  const flowGrid = document.createElement('div');
  flowGrid.className = 'jarvis-cc-flow-intel__grid';

  const mkCard = (title, bodyHtml) => {
    const c = document.createElement('div');
    c.className = 'jarvis-cc-flow-intel__card';
    c.innerHTML = `<h4>${title}</h4><div class="jarvis-cc-flow-intel__body">${bodyHtml}</div>`;
    return c;
  };

  const moneyLines = (fi?.hqNarrative?.dondeSePierdeDinero || []).length
    ? (fi.hqNarrative.dondeSePierdeDinero || []).map((t) => `<li>${t}</li>`).join('')
    : '<li class="muted">Sin fuga monetaria destacada en este corte (datos OK o cola liviana).</li>';

  const riesgoP = fi?.humanSignals?.riesgoOperacionalPorPersona || {};
  const riesgoUl = ['Gery', 'Romina', 'Lyn', 'otros', 'sin_asignar']
    .map((k) => `<li><strong>${k}</strong> · riesgo ${riesgoP[k] ?? 0}/100</li>`)
    .join('');

  const econ = fi?.economicState;
  const flow = fi?.flowState;
  const metricsHtml = `
    <ul class="jarvis-cc-flow-intel__metrics">
      <li>Ingreso proyectado hoy: <strong>$${Math.round(econ?.ingresoProyectadoHoy ?? 0).toLocaleString('es-CL')}</strong></li>
      <li>Ingreso bloqueado (OT abiertas): <strong>$${Math.round(econ?.ingresoBloqueado ?? 0).toLocaleString('es-CL')}</strong></li>
      <li>Fuga por demora (est.): <strong>$${Math.round(econ?.fugaDinero ?? 0).toLocaleString('es-CL')}</strong></li>
      <li>Opp. alta sin gestión &gt;72h: <strong>${econ?.oportunidadNoTomada ?? 0}</strong></li>
      <li>Ritmo: <strong>${flow?.ritmo ?? '—'}</strong> · saturación ~<strong>${flow?.saturacion ?? 0}%</strong> · cuello: <strong>${flow?.cuelloBotella ?? '—'}</strong></li>
      <li>Inactividad crítica: <strong>${flow?.inactividadCritica ? 'sí' : 'no'}</strong></li>
    </ul>`;

  flowGrid.append(
    mkCard('Dónde se está perdiendo dinero', `<ul>${moneyLines}</ul>`),
    mkCard('Quién frena el flujo', `<p>${fi?.hqNarrative?.personaFrenando || '—'}</p><ul class="small muted">${riesgoUl}</ul>`),
    mkCard('Acción de mayor impacto ya', `<p>${fi?.hqNarrative?.accionImpactoInmediato || '—'}</p>`),
    mkCard('Qué ignorar (ruido)', `<ul>${(fi?.hqNarrative?.ignorarRuido || []).map((t) => `<li class="muted">${t}</li>`).join('') || '<li class="muted">—</li>'}</ul>`),
    mkCard('Métricas en vivo', metricsHtml)
  );
  flowSec.append(flowGrid);

  const decBox = document.createElement('div');
  decBox.className = 'jarvis-cc-flow-intel__decision';
  const urg = decisionLayer?.urgenciaReal || '—';
  const urgClass = { critica: 'critica', alta: 'alta', media: 'media', baja: 'baja' }[urg] || 'media';
  decBox.innerHTML = `
    <h4>Capa de decisión (MAPE + flujo + económico)</h4>
    <p><strong>Foco:</strong> ${decisionLayer?.focoPrincipal ?? '—'}</p>
    <p><strong>Acción recomendada:</strong> ${decisionLayer?.accionRecomendada ?? '—'}</p>
    <p class="small"><strong>Impacto esperado:</strong> ${decisionLayer?.impactoEsperado ?? '—'}</p>
    <p class="jarvis-cc-flow-intel__urgency jarvis-cc-flow-intel__urgency--${urgClass}"><strong>Urgencia real:</strong> ${urg}</p>
    ${pulseSt.running ? '<p class="muted small">Pulse activo: capa fusionada en cada ciclo.</p>' : ''}
  `;
  flowSec.append(decBox);
  jarvisSecondaryDeck.append(flowSec);

  /* —— Control empresarial (átomo + energía + sanación + evolución + comercial) —— */
  const atom = unified.jarvisAtom;
  const heal = unified.jarvisSelfHealing;
  const evo = unified.jarvisEvolution;
  const commAdv = unified.jarvisCommercialIntelAdvanced;
  const busErr = unified.jarvisBusinessErrors;

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const ent = document.createElement('section');
  ent.className = 'jarvis-cc-enterprise';
  ent.innerHTML = `<h3 class="jarvis-cc-section-title jarvis-cc-enterprise__title">Sistema operativo empresarial</h3>`;
  const entMantra = document.createElement('p');
  entMantra.className = 'jarvis-cc-enterprise__mantra muted small';
  entMantra.textContent = atom?.mantra || 'Protejo el sistema, acelero el dinero y elimino fricción.';
  ent.append(entMantra);

  const entGrid = document.createElement('div');
  entGrid.className = 'jarvis-cc-enterprise__grid';

  const atomCard = document.createElement('div');
  atomCard.className = 'jarvis-cc-enterprise__card';
  atomCard.innerHTML = `<h4>⚛️ Estado del átomo</h4>`;
  const atomBody = document.createElement('div');
  atomBody.className = 'jarvis-cc-enterprise__body';
  const n = atom?.núcleo;
  const e = atom?.electrones;
  const o = atom?.órbitas;
  const en = atom?.energía;
  const st = atom?.estabilidad;
  atomBody.innerHTML = `
    <p><strong>Núcleo (decisión):</strong> ${n?.ok ? 'OK' : '⚠️ revisar'}</p>
    <p class="small muted">Electrones: OT ${e?.otCount ?? '—'} · correo ${e?.correoCount ?? '—'} · comercial ${e?.comercialCount ?? '—'} · vault ${e?.vaultCount ?? '—'}</p>
    <p class="small muted">Órbitas Pulse: ${o?.pulseActivo ? 'activo' : 'pausado'} · último ${o?.ultimoCicloTipo ?? '—'}</p>
    <p class="small muted">Estabilidad MAPE: salud ${st?.systemHealth ?? '—'} · riesgo ${st?.riskLevel ?? '—'}</p>
    <ul class="jarvis-cc-enterprise__alerts">${(atom?.alertasDerivadas || [])
      .map((a) => `<li class="jarvis-cc-enterprise__alert--${esc(a.severidad)}">${esc(a.texto)}</li>`)
      .join('') || '<li class="muted">Sin alertas del átomo.</li>'}</ul>
  `;
  atomCard.append(atomBody);

  const energyCard = document.createElement('div');
  energyCard.className = 'jarvis-cc-enterprise__card';
  energyCard.innerHTML = `<h4>💸 Energía económica</h4>`;
  energyCard.append(
    (() => {
      const d = document.createElement('div');
      d.className = 'jarvis-cc-enterprise__body';
      d.innerHTML = `
        <p>Proyectado hoy: <strong>$${Math.round(en?.ingresoProyectadoHoy ?? 0).toLocaleString('es-CL')}</strong></p>
        <p>Bloqueado: <strong>$${Math.round(en?.ingresoBloqueado ?? 0).toLocaleString('es-CL')}</strong> · Fuga demora: <strong>$${Math.round(en?.fugaDinero ?? 0).toLocaleString('es-CL')}</strong></p>
        <p class="small">Potencial mes: <strong>$${Math.round(en?.potencialMes ?? 0).toLocaleString('es-CL')}</strong> · Opp. sin gestión: <strong>${en?.oportunidadNoTomada ?? 0}</strong></p>
        <p class="small ${en?.baja ? 'jarvis-cc-enterprise__warn' : ''}">${en?.baja ? 'Energía baja: acelerar ingresos.' : 'Energía dentro de rango operativo para este corte.'}</p>
      `;
      return d;
    })()
  );

  const healCard = document.createElement('div');
  healCard.className = 'jarvis-cc-enterprise__card';
  healCard.innerHTML = `<h4>🧠 Auto-reparación sugerida</h4>`;
  const healUl = document.createElement('ul');
  healUl.className = 'jarvis-cc-enterprise__list';
  const hItems = (heal?.items || []).slice(0, 6);
  if (!hItems.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin anomalías estructurales detectadas — no se sugieren correcciones.';
    healUl.append(li);
  } else {
    for (const it of hItems) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>P${it.prioridad}</strong> · ${esc(it.tipoError)} — ${esc(it.impacto)}<br/><span class="small muted">${esc(it.accionSugerida)}</span>`;
      healUl.append(li);
    }
  }
  healCard.append(healUl);

  const evoCard = document.createElement('div');
  evoCard.className = 'jarvis-cc-enterprise__card';
  evoCard.innerHTML = `<h4>🚀 Evolución del sistema</h4>`;
  const evoUl = document.createElement('ul');
  evoUl.className = 'jarvis-cc-enterprise__list';
  for (const s of evo?.sugerencias || ['—']) {
    const li = document.createElement('li');
    li.textContent = s;
    evoUl.append(li);
  }
  evoCard.append(evoUl);

  const commCard = document.createElement('div');
  commCard.className = 'jarvis-cc-enterprise__card';
  commCard.innerHTML = `<h4>🎯 Inteligencia comercial</h4>`;
  const hot = (commAdv?.oportunidadesCalientes || []).slice(0, 4);
  const sleep = (commAdv?.clientesDormidos || []).slice(0, 4);
  const zones = (commAdv?.zonasSubexplotadas || []).slice(0, 4);
  const prob = commAdv?.probabilidadCierre?.promedioPipeline;
  commCard.innerHTML = `
    <div class="jarvis-cc-enterprise__body">
      <p class="small"><strong>Prob. cierre (cartera ~promedio):</strong> ${prob != null ? `${prob}%` : '—'}</p>
      <p class="small"><strong>Calientes:</strong></p>
      <ul class="jarvis-cc-enterprise__compact">${hot.map((x) => `<li>${esc(x.cliente)} · $${Math.round(x.estimacionMonto).toLocaleString('es-CL')} · ~${x.probabilidadCierre}%</li>`).join('') || '<li class="muted">—</li>'}</ul>
      <p class="small"><strong>Clientes dormidos:</strong></p>
      <ul class="jarvis-cc-enterprise__compact">${sleep.map((x) => `<li>${esc(x.cliente)} · ${Math.round(x.maxHoras)}h</li>`).join('') || '<li class="muted">—</li>'}</ul>
      <p class="small"><strong>Zonas subexplotadas (bajo cierre):</strong></p>
      <ul class="jarvis-cc-enterprise__compact">${zones.map((z) => `<li>${esc(z.comuna)} · ${z.ratioCierre}% cierre (${z.totalOt} OT)</li>`).join('') || '<li class="muted">—</li>'}</ul>
    </div>
  `;

  const busCard = document.createElement('div');
  busCard.className = 'jarvis-cc-enterprise__card jarvis-cc-enterprise__card--wide';
  const fug = busErr?.fugaIngresos;
  const ma = busErr?.malaAsignacion;
  const tm = busErr?.tiempoMuerto;
  const ine = busErr?.ineficiencia;
  busCard.innerHTML = `<h4>⚠️ Errores de negocio</h4>
    <div class="jarvis-cc-enterprise__body">
      <p><strong>Fuga ingresos:</strong> ${(fug?.detalle || []).map((t) => esc(t)).join(' ') || 'Sin señales fuertes.'}</p>
      <p><strong>Mala asignación:</strong> ${esc(ma?.mensaje)} (${ma?.sinTecnico ?? 0} OT sin técnico)</p>
      <p><strong>Tiempo muerto:</strong> ${esc(tm?.detalle)} ${tm?.diasPromedioAbiertas != null ? `· ~${tm.diasPromedioAbiertas} días prom. abiertas` : ''}</p>
      <p><strong>Ineficiencia:</strong> ${esc(ine?.mensaje)}</p>
      ${(busErr?.meta?.otAbiertasSinMotivoClaro ?? 0) > 0 ? `<p class="small muted">OT abiertas con poco contexto: ${busErr.meta.otAbiertasSinMotivoClaro}</p>` : ''}
    </div>`;

  entGrid.append(atomCard, energyCard, healCard, evoCard, commCard, busCard);
  ent.append(entGrid);
  jarvisSecondaryDeck.append(ent);

  /* —— Jarvis Operador (análisis continuo) —— */
  const opPulse = getJarvisPulseState().running ? jarvisRuntimeGetOperadorPack() : null;
  const op = opPulse || unified.jarvisOperador || {};
  const opEsc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const opSec = document.createElement('section');
  opSec.className = 'jarvis-cc-operador';
  opSec.innerHTML = `<h3 class="jarvis-cc-section-title">Modo Jarvis Operador</h3>`;
  const opMantra = document.createElement('p');
  opMantra.className = 'muted small jarvis-cc-operador__mantra';
  opMantra.textContent =
    (op?.mantra || 'No gestiono tareas, gestiono dinero, riesgo y oportunidad.') +
    (op?.pulseMeta
      ? ` · Pulse: ${op.pulseMeta.ciclo}${op.pulseMeta.operadorCambio ? ' · cambio detectado' : ''}`
      : '');
  opSec.append(opMantra);

  const opGrid = document.createElement('div');
  opGrid.className = 'jarvis-cc-operador__grid';

  const ml = op?.moneyLeaks || {};
  const urgSlug = (u) => ({ critica: 'critica', alta: 'alta', media: 'media', baja: 'baja' }[u] || 'media');
  const moneyCard = document.createElement('div');
  moneyCard.className = 'jarvis-cc-operador__card';
  moneyCard.innerHTML = `<h4>💸 Dinero en riesgo</h4>`;
  moneyCard.append(
    (() => {
      const el = document.createElement('div');
      el.className = 'jarvis-cc-operador__body';
      const uM = ml.urgencia || 'media';
      el.innerHTML = `
        <p>Bloqueado: <strong>$${Math.round(ml.ingresoBloqueado || 0).toLocaleString('es-CL')}</strong></p>
        <p>Fuga (demora est.): <strong>$${Math.round(ml.fugaDinero || 0).toLocaleString('es-CL')}</strong></p>
        <p>Oportunidades perdidas (alta sin gestión): <strong>${ml.oportunidadPerdida ?? 0}</strong></p>
        <p class="jarvis-cc-operador__urg--${urgSlug(uM)}"><strong>Urgencia:</strong> ${opEsc(uM)}</p>
      `;
      return el;
    })()
  );

  const dr = op?.documentReview || {};
  const errores = dr.erroresDetectados || [];
  const crit = errores.filter((e) => e.severidad === 'critical' || e.severidad === 'warning').slice(0, 8);
  const probCard = document.createElement('div');
  probCard.className = 'jarvis-cc-operador__card';
  probCard.innerHTML = `<h4>🚨 Problemas críticos</h4>`;
  const probUl = document.createElement('ul');
  probUl.className = 'jarvis-cc-operador__list';
  const list = crit.length ? crit : errores.slice(0, 6);
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin errores documentales/correo destacados en este corte.';
    probUl.append(li);
  } else {
    for (const e of list) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="jarvis-cc-operador__sev--${String(e.severidad || 'info').replace(/[^a-z]/gi, '')}">${opEsc(e.codigo)}</span> · ${opEsc(e.detalle)}`;
      probUl.append(li);
    }
  }
  probCard.append(probUl);
  probCard.append(
    (() => {
      const p = document.createElement('p');
      p.className = 'small muted';
      p.textContent = `Nivel riesgo revisión: ${dr.nivelRiesgo || '—'} · ${dr.impactoEconomico || ''}`;
      return p;
    })()
  );

  const dec = op?.decision || {};
  const pr = dec.prioridadReal || 'media';
  const decCard = document.createElement('div');
  decCard.className = 'jarvis-cc-operador__card jarvis-cc-operador__card--accent';
  decCard.innerHTML = `<h4>🧠 Decisión del sistema</h4>
    <div class="jarvis-cc-operador__body">
      <p><strong>Foco:</strong> ${opEsc(dec.focoPrincipal)}</p>
      <p><strong>Acción inmediata:</strong> ${opEsc(dec.accionInmediata)}</p>
      <p class="small"><strong>Impacto:</strong> ${opEsc(dec.impacto)}</p>
      <p class="jarvis-cc-operador__urg--${urgSlug(pr)}"><strong>Prioridad real:</strong> ${opEsc(pr)}</p>
      <p class="small muted">${opEsc(dec.dondeEstaElDinero || '')}</p>
      <p class="small muted"><strong>Qué frena:</strong> ${opEsc(dec.queLoFrena || '—')}</p>
    </div>`;

  const oe = op?.opportunityEngine || {};
  const oppCard = document.createElement('div');
  oppCard.className = 'jarvis-cc-operador__card';
  oppCard.innerHTML = `<h4>🎯 Oportunidad detectada</h4>
    <div class="jarvis-cc-operador__body">
      <p>${opEsc(oe.oportunidadDetectada)}</p>
      <p>Valor estimado: <strong>$${Math.round(oe.valorEstimado || 0).toLocaleString('es-CL')}</strong> · Prob. cierre ~<strong>${oe.probabilidadCierre ?? '—'}%</strong></p>
      <p class="small"><strong>Acción:</strong> ${opEsc(oe.accion)}</p>
    </div>`;

  const ta = op?.teamAnalysis || {};
  const teamCard = document.createElement('div');
  teamCard.className = 'jarvis-cc-operador__card';
  teamCard.innerHTML = `<h4>👥 Estado del equipo</h4>`;
  const teamBody = document.createElement('div');
  teamBody.className = 'jarvis-cc-operador__body';
  const rp = ta.riesgoPorPersona || {};
  teamBody.innerHTML = `
    <p class="small"><strong>Riesgo:</strong> Gery ${rp.Gery ?? 0} · Romina ${rp.Romina ?? 0} · Lyn ${rp.Lyn ?? 0} · otros ${rp.otros ?? 0} · sin asignar ${rp.sin_asignar ?? 0}</p>
    <p class="small"><strong>Dependencia:</strong> ${opEsc(ta.dependencia || '—')}</p>
    <p>${opEsc(ta.recomendacion)}</p>
    <p class="muted small">${opEsc(ta._meta?.quienNoResponde || '')} ${opEsc(ta._meta?.quienRetrasa || '')}</p>
  `;
  teamCard.append(teamBody);

  opGrid.append(moneyCard, probCard, decCard, oppCard, teamCard);
  opSec.append(opGrid);
  jarvisSecondaryDeck.append(opSec);

  }

  /* —— B. Radar —— */
  if (auto && showLegacyDashboard) {
    const radarSec = document.createElement('section');
    radarSec.className = 'jarvis-cc-radar';
    const dash = (pct, r) => {
      const c = 2 * Math.PI * r;
      const p = Math.min(100, Math.max(0, Number(pct) || 0)) / 100;
      return `${(p * c).toFixed(1)} ${c}`;
    };
    const cards = document.createElement('div');
    cards.className = 'jarvis-cc-radar-cards';
    const card = (label, val, mod) => {
      const d = document.createElement('div');
      d.className = `jarvis-cc-radar-card jarvis-cc-radar-card--${mod}`;
      d.innerHTML = `<span class="jarvis-cc-radar-card__l">${label}</span><span class="jarvis-cc-radar-card__v">${val}</span>`;
      return d;
    };
    cards.append(
      card('Salud sistema', `${auto.systemHealth}/100`, 'health'),
      card('Riesgo', String(auto.riskLevel || '—'), 'risk'),
      card('Eficiencia', `${auto.efficiencyScore}/100`, 'eff'),
      card('Oportunidad', `${auto.opportunityScore}/100`, 'opp')
    );
    const svgBox = document.createElement('div');
    svgBox.className = 'jarvis-cc-radar-svg';
    svgBox.innerHTML = `
      <svg viewBox="0 0 120 120" aria-hidden="true" class="jarvis-cc-svg-ring">
        <g transform="translate(60,60)">
          <circle r="50" fill="none" stroke="rgba(56,189,248,0.08)" stroke-width="6"/>
          <circle r="50" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash(auto.systemHealth, 50)}" transform="rotate(-90)" class="jarvis-cc-svg-anim"/>
          <circle r="38" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-dasharray="${dash(auto.efficiencyScore, 38)}" transform="rotate(-90)"/>
          <circle r="26" fill="none" stroke="#fbbf24" stroke-width="4" stroke-linecap="round" stroke-dasharray="${dash(auto.opportunityScore, 26)}" transform="rotate(-90)"/>
        </g>
      </svg>`;
    radarSec.append(cards, svgBox);
    jarvisSecondaryDeck.append(radarSec);
  }

  /* —— Sostenibilidad —— */
  let sus = null;
  if (showLegacyDashboard) {
  sus = document.createElement('section');
  sus.className = 'jarvis-cc-sustain';
  sus.innerHTML = `<h3 class="jarvis-cc-section-title">Capacidad del sistema</h3>`;
  const susGrid = document.createElement('div');
  susGrid.className = 'jarvis-cc-sustain-grid';
  susGrid.innerHTML = `
    <div class="jarvis-cc-sus-item"><span>Salud</span><strong>${sustain.systemHealth ?? auto?.systemHealth ?? '—'}</strong></div>
    <div class="jarvis-cc-sus-item"><span>Aprendizaje (heurístico)</span><strong>${sustain.learningLevel ?? '—'}/100</strong></div>
    <div class="jarvis-cc-sus-item"><span>Cobertura memoria</span><strong>${sustain.memoryCoverage ?? '—'}%</strong></div>
    <div class="jarvis-cc-sus-item"><span>Cobertura fuentes</span><strong>${sustain.sourceCoverage ?? '—'}%</strong></div>
  `;
  sus.append(susGrid);
  const blind = document.createElement('ul');
  blind.className = 'jarvis-cc-blind';
  (sustain.blindSpots || []).forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    blind.append(li);
  });
  if (!blind.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin vacíos críticos declarados en este corte.';
    blind.append(li);
  }
  sus.append(blind);
  jarvisSecondaryDeck.append(sus);
  }

  /* —— Actividad viva —— */
  let liveSec = null;
  if (showLegacyDashboard) {
  liveSec = document.createElement('section');
  liveSec.className = 'jarvis-cc-live';
  liveSec.innerHTML = `<h3 class="jarvis-cc-section-title">Actividad viva del sistema</h3>`;
  const liveUl = document.createElement('ul');
  liveUl.className = 'jarvis-cc-live-list';
  (live?.currentSignals || []).forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    liveUl.append(li);
  });
  if (!liveUl.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent =
      'Sin señales — revisá conexión o activá toggles de ingesta (Centro de control). No se inventan datos.';
    liveUl.append(li);
  }
  liveSec.append(liveUl);
  jarvisSecondaryDeck.append(liveSec);
  }

  /* —— Centro directivo H/L —— */
  const dly = unified.outlookFollowUp?.delayAlerts || [];
  const forH = dly.filter((a) => a.reportarAHernan);
  const forL = dly.filter((a) => a.reportarALyn);
  const hl = document.createElement('section');
  hl.className = 'jarvis-cc-hl';
  hl.innerHTML = `<h3 class="jarvis-cc-section-title">Centro directivo H / L</h3>`;
  const hlGrid = document.createElement('div');
  hlGrid.className = 'jarvis-cc-hl-grid';

  const mkCol = (title, alerts) => {
    const col = document.createElement('div');
    col.className = 'jarvis-cc-hl-col';
    col.innerHTML = `<h4>${title}</h4>`;
    const ul = document.createElement('ul');
    alerts.slice(0, 8).forEach((a) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${a.title || a.code}</strong><p class="muted small">${a.detail || ''} · ${a.owner || '—'}</p>`;
      if (a.nav?.view) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'link-button small';
        b.textContent = 'Ir';
        b.addEventListener('click', () => intelNavigate?.(a.nav));
        li.append(b);
      }
      ul.append(li);
    });
    if (!ul.childElementCount) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Nada escalado explícito en correo — revisá alertas generales.';
      ul.append(li);
    }
    col.append(ul);
    return col;
  };

  const escH = mergeBucket(board, auto, 'escalar_a_hernan').slice(0, 6);
  const escL = mergeBucket(board, auto, 'escalar_a_lyn').slice(0, 6);

  hlGrid.append(
    mkCol('Para Hernán (correo + escala MAPE)', [
      ...forH.map((x) => ({ ...x, nav: x.nav || { view: 'jarvis-intake' } })),
      ...escH.map((x) => ({
        title: x.titulo,
        detail: x.detalle,
        owner: 'MAPE',
        nav: x.nav,
      })),
    ]),
    mkCol('Para Lyn (correo + escala MAPE)', [
      ...forL.map((x) => ({ ...x, nav: x.nav || { view: 'jarvis-intake' } })),
      ...escL.map((x) => ({
        title: x.titulo,
        detail: x.detalle,
        owner: 'MAPE',
        nav: x.nav,
      })),
    ])
  );
  hl.append(hlGrid);

  const romG = document.createElement('div');
  romG.className = 'jarvis-cc-hl-follow';
  romG.innerHTML = `<h4>Romina / Gery / sin dueño</h4>`;
  const romUl = document.createElement('ul');
  romUl.className = 'jarvis-cc-mini';
  romUl.innerHTML = `
    <li>Romina (correo abierto): <strong>${live?.currentFollowUps?.romina ?? 0}</strong></li>
    <li>Gery: <strong>${live?.currentFollowUps?.gery ?? 0}</strong></li>
    <li>Lyn: <strong>${live?.currentFollowUps?.lyn ?? 0}</strong></li>
    <li>Sin dueño: <strong>${live?.currentFollowUps?.sinDueno ?? 0}</strong></li>
  `;
  romG.append(romUl);
  const bIn = document.createElement('button');
  bIn.type = 'button';
  bIn.className = 'secondary-button jarvis-cc-btn-touch';
  bIn.textContent = 'Abrir Intake Hub';
  bIn.addEventListener('click', () => intelNavigate?.({ view: 'jarvis-intake' }));
  romG.append(bIn);
  hl.append(romG);
  jarvisSecondaryDeck.append(hl);

  if (showLegacyDashboard) {
  /* —— Feed de mando —— */
  const feedSec = document.createElement('section');
  feedSec.className = 'jarvis-cc-feed';
  feedSec.innerHTML = `<h3 class="jarvis-cc-section-title">Resumen de mando</h3>`;
  const feedGrid = document.createElement('div');
  feedGrid.className = 'jarvis-cc-feed-grid';

  const mini = (tit, body) => {
    const d = document.createElement('div');
    d.className = 'jarvis-cc-feed-card';
    d.innerHTML = `<h4>${tit}</h4><p class="jarvis-cc-feed-body">${body}</p>`;
    return d;
  };

  const topActs = flattenTopActions(board, 5);
  const bloq = (brief.bloqueos || []).slice(0, 3).map((b) => b.texto || b).join(' · ') || '—';
  const perdida = brief.comercial?.urgentesPendientes
    ? `${brief.comercial.urgentesPendientes} urgentes · $${fmtMoney(brief.comercial.montoPotencial)} potencial`
    : '—';
  const lynDoc = `${brief.documentos.observados} observados · ${brief.documentos.porRevisar} en revisión`;
  const hernanMoney = `OT abiertas ${brief.operacion.otAbiertas} · listas cierre ${brief.operacion.otPorCerrar}`;

  feedGrid.append(
    mini('Qué hacer hoy', topActs.map((a) => a.titulo).join(' · ') || 'Sin top acciones.'),
    mini('Qué está frenado', bloq),
    mini('Qué puede estar perdiendo plata', perdida),
    mini('Qué revisa Lyn', lynDoc),
    mini('Qué revisa Hernán', hernanMoney)
  );
  feedSec.append(feedGrid);
  jarvisSecondaryDeck.append(feedSec);

  /* —— Resumen ejecutivo —— */
  const execBox = document.createElement('div');
  execBox.className = 'jarvis-cc-exec';
  execBox.innerHTML = `<p class="jarvis-cc-exec-label muted">Resumen ejecutivo</p><p class="jarvis-cc-exec-text">${brief.resumenEjecutivo}</p>`;
  jarvisSecondaryDeck.append(execBox);
  }

  /* —— Centro de alertas por bucket —— */
  const alertSec = document.createElement('section');
  alertSec.className = 'jarvis-cc-buckets';
  alertSec.innerHTML = `<h3 class="jarvis-cc-section-title">Centro de alertas y acciones</h3>`;
  const observeNote = observeOnly
    ? '<p class="muted small jarvis-cc-observe">Modo observación: análisis activo; botones «Ir» deshabilitados (sin CTAs de ejecución desde HQ).</p>'
    : '';
  alertSec.insertAdjacentHTML('beforeend', observeNote);

  for (const bucket of BUCKET_ORDER) {
    const items = mergeBucket(board, auto, bucket);
    if (!items.length) continue;
    const sub = document.createElement('details');
    sub.className = 'jarvis-cc-bucket';
    sub.open = bucket === 'ejecutar_hoy' || bucket === 'cobrar_hoy';
    sub.innerHTML = `<summary class="jarvis-cc-bucket-sum"><span>${bucket.replace(/_/g, ' ')}</span><span class="jarvis-cc-bucket-n">${items.length}</span></summary>`;
    const ul = document.createElement('ul');
    ul.className = 'jarvis-cc-bucket-list';
    items.slice(0, 12).forEach((it) => {
      const li = document.createElement('li');
      li.className = `jarvis-cc-bucket-item jarvis-cc-bucket-item--${it.severidad}`;
      li.innerHTML = `<span class="jarvis-cc-bucket-meta">${it.origen} · ${it.severidad}</span><strong>${it.titulo}</strong><p class="muted small">${it.detalle || ''}</p>${it.impacto ? `<p class="jarvis-cc-impact">Impacto: ${it.impacto}</p>` : ''}`;
      const row = document.createElement('div');
      row.className = 'jarvis-cc-bucket-cta';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'primary-button small jarvis-cc-btn-touch';
      go.textContent = 'Ir';
      go.disabled = observeOnly || execLevel === 'off';
      go.addEventListener('click', () => {
        const nav = it.raw?.nav || it.nav;
        if (nav?.view) {
          if (execLevel === 'assist' || execLevel === 'autonomic_safe') {
            rememberJarvisAction(it.raw || it, 'tomada', 'hq_bucket');
          }
          intelNavigate?.(nav);
        }
      });
      row.append(go);
      li.append(row);
      ul.append(li);
    });
    sub.append(ul);
    alertSec.append(sub);
  }
  jarvisSecondaryDeck.append(alertSec);

  if (showLegacyDashboard) {
  /* —— Vista de movimiento —— */
  const move = document.createElement('section');
  move.className = 'jarvis-cc-move';
  move.innerHTML = `<h3 class="jarvis-cc-section-title">Cómo se mueve Jarvis</h3>`;
  const tl = document.createElement('ul');
  tl.className = 'jarvis-cc-timeline';
  (live?.digestTimeline || []).forEach((ev) => {
    const li = document.createElement('li');
    li.className = 'jarvis-cc-tl-item';
    li.innerHTML = `<time>${fmtAt(ev.at)}</time><span class="jarvis-cc-tl-kind">${ev.kind}</span><p>${ev.label}</p>`;
    tl.append(li);
  });
  (auto?.analysis?.findings || [])
    .slice(0, 4)
    .forEach((f) => {
      const li = document.createElement('li');
      li.className = 'jarvis-cc-tl-item';
      li.innerHTML = `<time>análisis</time><span class="jarvis-cc-tl-kind">${f.code}</span><p>${f.title}</p>`;
      tl.append(li);
    });
  acMem.ultimos?.slice(0, 4).forEach((c) => {
    const li = document.createElement('li');
    li.className = 'jarvis-cc-tl-item';
    li.innerHTML = `<time>${fmtAt(c.at)}</time><span class="jarvis-cc-tl-kind">estado guardado</span><p>MAPE guardado · salud ${c.systemHealth} · riesgo ${c.riskLevel}</p>`;
    tl.append(li);
  });
  if (!tl.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin línea de tiempo aún — recalculá o guardá un estado MAPE.';
    tl.append(li);
  }
  move.append(tl);
  jarvisSecondaryDeck.append(move);
  }

  /* —— Panel autónomo seguro —— */
  if (auto && (execLevel === 'autonomic_safe' || ctrl.jarvisToggles.showExperimentalSignals)) {
    const ap = document.createElement('section');
    ap.className = 'jarvis-cc-auto-panel';
    ap.innerHTML = `<h3 class="jarvis-cc-section-title">Panel autónomo seguro</h3>
      <p class="muted small">Plan generado por MAPE local. <strong>No ejecuta:</strong> envío de mail, PATCH/POST al ERP, ni integraciones externas.</p>`;
    const why = document.createElement('ul');
    why.className = 'jarvis-cc-mini';
    (auto.improvements || []).slice(0, 6).forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      why.append(li);
    });
    ap.append(why);
    const pre = document.createElement('pre');
    pre.className = 'jarvis-cc-auto-report';
    pre.textContent = auto.selfReport || '';
    ap.append(pre);
    const row = document.createElement('div');
    row.className = 'jarvis-cc-auto-actions';
    const bM = document.createElement('button');
    bM.type = 'button';
    bM.className = 'secondary-button jarvis-cc-btn-touch';
    bM.textContent = 'Persistir MAPE (memoria local)';
    bM.addEventListener('click', () => {
      const r = runJarvisAutonomicCycle(data || {}, { persistMemory: true });
      if (r?.skipped) alert('Activá un modo distinto de Off para guardar MAPE.');
    });
    row.append(bM);
    ap.append(row);
    jarvisSecondaryDeck.append(ap);
  }

  if (showLegacyDashboard) {
  /* —— Riesgos ejecutivos (compacto) —— */
  const riskSec = document.createElement('section');
  riskSec.className = 'jarvis-cc-risks';
  riskSec.innerHTML = `<h3 class="jarvis-cc-section-title">Alertas dirección</h3>`;
  const ulR = document.createElement('ul');
  ulR.className = 'jarvis-cc-risk-list';
  (execPack.alerts || []).slice(0, 10).forEach((r) => {
    const li = document.createElement('li');
    li.className = `jarvis-cc-risk jarvis-cc-risk--${r.severity || 'info'}`;
    li.innerHTML = `<strong>${r.title}</strong> <span class="muted small">${r.detail || ''}</span>`;
    if (r.nav?.view) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'link-button small';
      b.textContent = 'Navegar';
      b.addEventListener('click', () => intelNavigate?.(r.nav));
      li.append(b);
    }
    ulR.append(li);
  });
  if (!ulR.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin alertas de dirección en este corte.';
    ulR.append(li);
  }
  riskSec.append(ulR);
  jarvisSecondaryDeck.append(riskSec);

  /* —— Paneles de valor —— */
  const valGrid = document.createElement('div');
  valGrid.className = 'jarvis-cc-value-grid';

  const valCard = (t, html, nav) => {
    const s = document.createElement('section');
    s.className = 'jarvis-cc-value-card';
    s.innerHTML = `<h3>${t}</h3>${html}`;
    if (nav) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button jarvis-cc-btn-touch';
      b.textContent = 'Abrir';
      b.addEventListener('click', () => intelNavigate?.(nav));
      s.append(b);
    }
    return s;
  };

  valGrid.append(
    valCard(
      'Comercial',
      `<ul class="jarvis-cc-mini"><li>Potencial mes: $${fmtMoney(brief.comercial.montoPotencial)}</li><li>Urgentes: ${brief.comercial.urgentesPendientes}</li></ul>`,
      { view: 'oportunidades' }
    ),
    valCard(
      'Documentos',
      `<ul class="jarvis-cc-mini"><li>Revisión: ${brief.documentos.porRevisar}</li><li>Observados: ${brief.documentos.observados}</li></ul>`,
      { view: 'technical-documents' }
    ),
    valCard(
      'Vault',
      `<ul class="jarvis-cc-mini"><li>Registros: ${live?.currentVault?.registros ?? 0}</li></ul>`,
      { view: 'jarvis-vault' }
    ),
    valCard(
      'Operación',
      `<ul class="jarvis-cc-mini"><li>OT abiertas: ${brief.operacion.otAbiertas}</li><li>Calendario hoy: ${brief.calendario.visitasHoy}</li></ul>`,
      { view: 'clima' }
    )
  );
  jarvisSecondaryDeck.append(valGrid);

  /* —— Brief director + memoria —— */
  const director = document.createElement('pre');
  director.className = 'jarvis-cc-director';
  director.setAttribute('aria-label', 'Brief directores');
  director.textContent = directorText;
  jarvisSecondaryDeck.append(director);

  const mem = document.createElement('section');
  mem.className = 'jarvis-cc-mem';
  mem.innerHTML = `<h3 class="jarvis-cc-section-title">Memoria y patrones</h3><p class="muted small">Briefs: ${memorySummary.briefsGuardados} · último ${fmtAt(memorySummary.ultimoBriefAt)}</p>`;
  const ulP = document.createElement('ul');
  ulP.className = 'jarvis-cc-mini';
  (patterns.textoPatrones || []).forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    ulP.append(li);
  });
  if (!ulP.childElementCount) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin patrones textuales aún.';
    ulP.append(li);
  }
  mem.append(ulP);
  jarvisSecondaryDeck.append(mem);

  const secFeed = document.createElement('section');
  secFeed.className = 'jarvis-cc-decisions';
  secFeed.innerHTML = `<h3 class="jarvis-cc-section-title">Señales consolidadas</h3>`;
  const ulF = document.createElement('ul');
  ulF.className = 'jarvis-cc-feed-lines';
  feedFromUnified(unified, brief, board).forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    ulF.append(li);
  });
  secFeed.append(ulF);
  jarvisSecondaryDeck.append(secFeed);
  }

  if (pageTail && pageTail.childElementCount) {
    jarvisSecondaryDeck.append(pageTail);
  }

  return root;
};
