import {
  ASSISTANT_PRESETS,
  buildIntelligenceSnapshot,
  buildPriorityQueue,
  collectDiagnostics,
  matchAssistantIntent,
  runAssistantQuery,
  todayYmd,
} from '../domain/intelligence-engine.js';
import {
  attachGuidanceToIntelNav,
  buildIntelExecutionQueue,
  buildTodayOperationsPanel,
  detectOperationalIssues,
  generateActionPlan,
  getDirectorOperationalBrief,
  getOperationalHealthState,
  getOperationalSnapshot,
  getProactiveSignals,
  runAIAnalysis,
} from '../domain/hnf-intelligence-engine.js';
import { createHnfAutopilotPanel } from '../components/hnf-autopilot-panel.js';
import { intelligenceLog } from '../utils/intelligence-logger.js';

const formatRefresh = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
};

const severityClass = (s) => {
  if (s === 'critical') return 'ia-diag ia-diag--critical';
  if (s === 'warning') return 'ia-diag ia-diag--warning';
  return 'ia-diag ia-diag--info';
};

export const asistenteIaView = ({
  data,
  integrationStatus,
  lastDataRefreshAt,
  reloadApp,
  intelNavigate,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'ia-module ia-console';

  const header = document.createElement('div');
  header.className = 'module-header ia-console__header';
  header.innerHTML = `
    <p class="dashboard-eyebrow ia-module__eyebrow">HNF Intelligence Engine</p>
    <h2>Directora operativa (reglas + datos)</h2>
    <p class="muted">Vista consola: prioridades, acciones y diagnóstico sobre el mismo snapshot (no es chat).</p>
  `;

  const toolbar = document.createElement('div');
  toolbar.className = 'module-toolbar ia-toolbar';
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'secondary-button';
  refreshBtn.textContent = 'Actualizar datos';
  refreshBtn.title = 'Misma carga que Inicio: OT, flota, planificación, salud API.';
  const meta = document.createElement('span');
  meta.className = 'muted module-toolbar__hint';
  meta.textContent = `Última sincronización: ${formatRefresh(lastDataRefreshAt)} · Hoy (local): ${todayYmd()}`;
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Actualizando…';
    intelligenceLog('info', 'UI_REFRESH', 'asistente manual reload');
    try {
      await reloadApp?.();
    } finally {
      refreshBtn.textContent = 'Actualizar datos';
      refreshBtn.disabled = false;
    }
  });
  toolbar.append(refreshBtn, meta);

  if (integrationStatus === 'sin conexión') {
    const ban = document.createElement('div');
    ban.className = 'integration-banner integration-banner--offline';
    ban.setAttribute('role', 'status');
    ban.textContent =
      'Sin conexión al servidor. El asistente no puede analizar datos actuales. Reconectá y actualizá.';
    section.append(header, toolbar, ban);
    return section;
  }

  const directorBrief = getDirectorOperationalBrief(data || {});
  const autopilotPanel = createHnfAutopilotPanel({
    brief: directorBrief,
    viewData: data,
    intelNavigate,
  });

  let snapshot;
  try {
    snapshot = buildIntelligenceSnapshot(data || {});
    intelligenceLog('info', 'SNAPSHOT', 'built', {
      ots: snapshot.ots.length,
      flota: snapshot.flota.length,
      mant: snapshot.mantenciones.length,
    });
  } catch (e) {
    intelligenceLog('error', 'SNAPSHOT_FAIL', String(e?.message || e));
    const err = document.createElement('div');
    err.className = 'form-feedback form-feedback--error';
    err.textContent = 'No se pudieron normalizar los datos para análisis. Probá «Actualizar datos» o revisá la consola.';
    section.append(header, toolbar, autopilotPanel, err);
    return section;
  }

  const opSnap = getOperationalSnapshot(data || {});
  const opIssues = detectOperationalIssues(opSnap, data || {});
  const opPlan = generateActionPlan(opIssues);
  const proactive = getProactiveSignals(opSnap);
  const health = getOperationalHealthState(opIssues);
  void runAIAnalysis(opSnap);

  const execQ = buildIntelExecutionQueue(data || {});
  const todayExec = buildTodayOperationsPanel(data || {});

  const estadoLabel = health === 'critico' ? 'Crítico' : health === 'atencion' ? 'Atención' : 'Óptimo';
  const statusStrip = document.createElement('div');
  statusStrip.className = `ia-console-status ia-console-status--${health}`;
  statusStrip.setAttribute('role', 'status');
  const stK = document.createElement('span');
  stK.className = 'ia-console-status__k';
  stK.textContent = 'Estado general';
  const stV = document.createElement('strong');
  stV.className = 'ia-console-status__v';
  stV.textContent = estadoLabel;
  const stH = document.createElement('span');
  stH.className = 'ia-console-status__hint';
  stH.textContent =
    health === 'optimo'
      ? 'Sin críticos ni atención con las reglas vigentes.'
      : `${opIssues.filter((i) => i.tipo === 'CRITICO').length} crítico(s) · ${opIssues.filter((i) => i.tipo === 'ATENCION').length} atención · ${execQ.length} en cola ejecutable`;
  statusStrip.append(stK, stV, stH);

  const critBlock = document.createElement('div');
  critBlock.className = 'ia-console-block ia-console-block--crit';
  const critH = document.createElement('h3');
  critH.className = 'ia-section-title';
  critH.textContent = 'Problemas críticos';
  const critUl = document.createElement('ul');
  critUl.className = 'ia-exec-deck__crit';
  const crits = execQ.filter((x) => x.tipo === 'CRITICO').slice(0, 8);
  if (!crits.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin críticos en cola.';
    critUl.append(li);
  } else {
    crits.forEach((it) => {
      const li = document.createElement('li');
      li.className = 'ia-exec-deck__item ia-exec-deck__item--crit';
      const sp = document.createElement('span');
      sp.className = 'ia-exec-deck__item-t';
      sp.textContent = it.titulo;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'primary-button ia-exec-deck__resolve';
      b.textContent = 'Resolver ahora';
      b.addEventListener('click', () => intelNavigate?.(it.nav));
      li.append(sp, b);
      critUl.append(li);
    });
  }
  critBlock.append(critH, critUl);

  const todayBlock = document.createElement('div');
  todayBlock.className = 'ia-console-block ia-console-block--today';
  const todayH = document.createElement('h3');
  todayH.className = 'ia-section-title';
  todayH.textContent = 'Qué hacer hoy';
  const todayGrid = document.createElement('div');
  todayGrid.className = 'ia-console-today-grid';

  const mkTodayCol = (title, items, emptyMsg) => {
    const col = document.createElement('div');
    col.className = 'ia-console-today-col';
    const h = document.createElement('h4');
    h.className = 'ia-subtitle';
    h.textContent = title;
    const ul = document.createElement('ul');
    ul.className = 'ia-exec-deck__crit';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = emptyMsg;
      ul.append(li);
    } else {
      items.forEach((it) => {
        const li = document.createElement('li');
        li.className = 'ia-exec-deck__item';
        const sp = document.createElement('span');
        sp.textContent = it.titulo;
        li.append(sp);
        if (it.nav) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'primary-button ia-exec-deck__resolve';
          b.textContent = 'Resolver ahora';
          b.addEventListener('click', () => intelNavigate?.(it.nav));
          li.append(b);
        }
        ul.append(li);
      });
    }
    col.append(h, ul);
    return col;
  };

  todayGrid.append(
    mkTodayCol('Prioridades críticas', todayExec.prioridades, 'Sin críticos.'),
    mkTodayCol('Pendientes', todayExec.topPendientes, 'Sin pendientes.'),
    mkTodayCol('Listas para cerrar', todayExec.topCierres, 'Ninguna.'),
    mkTodayCol('Atención', todayExec.topRiesgos, 'Sin ítems.')
  );
  todayBlock.append(todayH, todayGrid);

  const quickBlock = document.createElement('div');
  quickBlock.className = 'ia-console-block ia-console-block--quick';
  const qh = document.createElement('h3');
  qh.className = 'ia-section-title';
  qh.textContent = 'Accesos rápidos';
  const quickUl = document.createElement('ul');
  quickUl.className = 'ia-exec-deck__quick';
  [
    {
      label: 'OT terminadas sin costo',
      nav: attachGuidanceToIntelNav({ view: 'clima', climaFilter: { sinCostoTerminadas: true } }, 'FILTER_SIN_COSTO', ''),
    },
    {
      label: 'Plan · atrasadas',
      nav: attachGuidanceToIntelNav(
        { view: 'planificacion', plan: { tab: 'plan', mantFilter: 'atrasadas' } },
        'PLAN_ATRASADAS',
        ''
      ),
    },
    {
      label: 'Plan · próximas',
      nav: attachGuidanceToIntelNav(
        { view: 'planificacion', plan: { tab: 'plan', mantFilter: 'proximas' } },
        'PLAN_PROXIMAS',
        ''
      ),
    },
  ].forEach(({ label, nav }) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button';
    b.textContent = label;
    b.addEventListener('click', () => intelNavigate?.(nav));
    li.append(b);
    quickUl.append(li);
  });
  quickBlock.append(qh, quickUl);

  const enginePanel = document.createElement('div');
  enginePanel.className = 'ia-engine-panel ia-engine-panel--secondary';
  const epTitle = document.createElement('div');
  epTitle.className = 'ia-engine-panel__bar';
  epTitle.innerHTML =
    '<span class="ia-engine-panel__label">SISTEMA</span><span class="ia-engine-panel__name">Señales y plan sugerido</span>';
  const epGrid = document.createElement('div');
  epGrid.className = 'ia-engine-grid ia-engine-grid--two';
  const sigBox = document.createElement('div');
  sigBox.className = 'ia-engine-block';
  sigBox.innerHTML = '<h4 class="ia-engine-block__h">Señales</h4>';
  const sigUl = document.createElement('ul');
  sigUl.className = 'ia-engine-syslist';
  (proactive.length ? proactive : ['Sin disparadores en umbrales actuales.']).forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    sigUl.append(li);
  });
  sigBox.append(sigUl);
  const planBox = document.createElement('div');
  planBox.className = 'ia-engine-block';
  planBox.innerHTML = '<h4 class="ia-engine-block__h">Plan sugerido</h4>';
  const planOl = document.createElement('ol');
  planOl.className = 'ia-engine-plan';
  opPlan.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    planOl.append(li);
  });
  planBox.append(planOl);
  epGrid.append(sigBox, planBox);
  enginePanel.append(epTitle, epGrid);

  const diagWrap = document.createElement('div');
  diagWrap.className = 'ia-diagnostics';
  const diagTitle = document.createElement('h3');
  diagTitle.className = 'ia-section-title';
  diagTitle.textContent = 'Diagnóstico extendido (por ítem)';
  diagWrap.append(diagTitle);

  const diagnostics = collectDiagnostics(snapshot);
  if (!diagnostics.length) {
    const p = document.createElement('p');
    p.className = 'muted ia-empty-smart';
    p.textContent =
      'No hay alertas automáticas con los datos actuales. Eso no garantiza que todo esté cerrado: revisá Clima y Flota de todas formas.';
    diagWrap.append(p);
  } else {
    const list = document.createElement('ul');
    list.className = 'ia-diag-list';
    diagnostics.slice(0, 14).forEach((d) => {
      const li = document.createElement('li');
      li.className = severityClass(d.severity);
      const t1 = document.createElement('span');
      t1.className = 'ia-diag__title';
      t1.textContent = d.title;
      const t2 = document.createElement('span');
      t2.className = 'ia-diag__detail';
      t2.textContent = d.detail;
      const t3 = document.createElement('span');
      t3.className = 'ia-diag__mod';
      t3.textContent = d.module;
      li.append(t1, t2, t3);
      list.append(li);
    });
    diagWrap.append(list);
  }

  const prio = buildPriorityQueue(snapshot);
  if (prio.length) {
    const pq = document.createElement('div');
    pq.className = 'ia-priority';
    pq.innerHTML = '<h4 class="ia-subtitle">Cola sugerida (modo automático futuro)</h4>';
    const ol = document.createElement('ol');
    ol.className = 'ia-priority-list';
    prio.slice(0, 8).forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${item.rank}. ${item.title} — ${item.detail}`;
      ol.append(li);
    });
    pq.append(ol);
    diagWrap.append(pq);
  }

  const answerHost = document.createElement('div');
  answerHost.className = 'ia-answer-host';

  const qaTitle = document.createElement('h3');
  qaTitle.className = 'ia-section-title';
  qaTitle.textContent = 'Consultas (mismo snapshot)';
  const chips = document.createElement('div');
  chips.className = 'ia-chips';

  const renderAnswer = (result) => {
    answerHost.innerHTML = '';
    const card = document.createElement('article');
    card.className = 'ia-answer-card ia-sys-panel';
    const h = document.createElement('h4');
    h.className = 'ia-answer-card__title';
    h.textContent = result.title;
    const intro = document.createElement('p');
    intro.className = 'ia-answer-card__intro';
    intro.textContent = result.intro;
    card.append(h, intro);
    if (result.bullets?.length) {
      const ul = document.createElement('ul');
      ul.className = 'ia-answer-list';
      result.bullets.forEach((line) => {
        const li = document.createElement('li');
        const parts = String(line).split('\n');
        parts.forEach((chunk, i) => {
          if (i > 0) li.append(document.createElement('br'));
          li.append(document.createTextNode(chunk));
        });
        ul.append(li);
      });
      card.append(ul);
    }
    if (result.foot) {
      const ft = document.createElement('p');
      ft.className = 'muted ia-answer-foot';
      ft.textContent = result.foot;
      card.append(ft);
    }
    answerHost.append(card);
  };

  const runId = (id) => {
    try {
      const result = runAssistantQuery(id, snapshot);
      renderAnswer(result);
    } catch (e) {
      renderAnswer({
        title: 'Error',
        intro: 'Fallo al ejecutar la consulta.',
        bullets: [String(e?.message || e)],
        foot: null,
      });
    }
  };

  ASSISTANT_PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button ia-chip';
    b.textContent = p.label;
    b.addEventListener('click', () => runId(p.id));
    chips.append(b);
  });

  const diagChip = document.createElement('button');
  diagChip.type = 'button';
  diagChip.className = 'primary-button ia-chip ia-chip--primary';
  diagChip.textContent = 'Ver diagnóstico completo';
  diagChip.addEventListener('click', () => runId('diagnostico'));
  chips.append(diagChip);

  const form = document.createElement('div');
  form.className = 'ia-freeform';
  const inp = document.createElement('input');
  inp.type = 'search';
  inp.className = 'ia-freeform__input';
  inp.placeholder = 'Ej.: ¿qué OT falta cerrar? · cobros pendientes · flota';
  const ask = document.createElement('button');
  ask.type = 'button';
  ask.className = 'primary-button';
  ask.textContent = 'Consultar';
  ask.addEventListener('click', () => {
    const intent = matchAssistantIntent(inp.value);
    runId(intent || 'help');
  });
  inp.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') ask.click();
  });
  form.append(inp, ask);

  const foot = document.createElement('p');
  foot.className = 'muted ia-footnote';
  foot.innerHTML =
    'Próximos pasos técnicos: API de análisis en backend, notificaciones proactivas y modelo de lenguaje sobre este mismo snapshot. Depuración: <code>localStorage.hnf.debugIntel = \"1\"</code>.';

  section.append(
    header,
    toolbar,
    autopilotPanel,
    statusStrip,
    critBlock,
    todayBlock,
    quickBlock,
    enginePanel,
    diagWrap,
    qaTitle,
    chips,
    form,
    answerHost,
    foot
  );

  runId('diagnostico');

  return section;
};
