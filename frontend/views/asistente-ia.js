import {
  ASSISTANT_PRESETS,
  buildIntelligenceSnapshot,
  buildPriorityQueue,
  collectDiagnostics,
  matchAssistantIntent,
  runAssistantQuery,
  todayYmd,
} from '../domain/intelligence-engine.js';
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
} = {}) => {
  const section = document.createElement('section');
  section.className = 'ia-module';

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML = `
    <p class="dashboard-eyebrow ia-module__eyebrow">Inteligencia operativa</p>
    <h2>Asistente IA HNF</h2>
    <p class="muted">Respuestas basadas en <strong>datos reales</strong> del servidor (sin modelo generativo externo en esta fase). Usá las preguntas rápidas o escribí en lenguaje natural. El motor analiza OT, flota y planificación de forma continua al cargar esta vista.</p>
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
    section.append(header, toolbar, err);
    return section;
  }

  const diagWrap = document.createElement('div');
  diagWrap.className = 'ia-diagnostics';
  const diagTitle = document.createElement('h3');
  diagTitle.className = 'ia-section-title';
  diagTitle.textContent = 'Diagnóstico automático (priorizado)';
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
  qaTitle.textContent = 'Consultas';
  const chips = document.createElement('div');
  chips.className = 'ia-chips';

  const renderAnswer = (result) => {
    answerHost.innerHTML = '';
    const card = document.createElement('article');
    card.className = 'ia-answer-card';
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

  section.append(header, toolbar, diagWrap, qaTitle, chips, form, answerHost, foot);

  runId('diagnostico');

  return section;
};
