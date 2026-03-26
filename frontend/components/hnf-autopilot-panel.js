import { getStoredOperatorName } from '../config/operator.config.js';
import {
  getAutopilotMetrics,
  getLastAutopilotCycle,
  HNF_AUTOPILOT_VERSION,
  listPendingApprovals,
  rejectAutopilotAction,
  approveAutopilotAction,
  runAutopilotCycle,
} from '../domain/hnf-autopilot.js';
import { getDirectorOperationalBrief } from '../domain/hnf-intelligence-engine.js';

const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
};

/**
 * Panel HNF Autopilot (no chat): ciclo, ejecutadas, aprobaciones, avisos, tiempo protegido.
 * @param {object} opts
 * @param {object} [opts.brief] - si se omite, se calcula con getDirectorOperationalBrief(opts.viewData)
 * @param {object} opts.viewData
 * @param {function} [opts.intelNavigate]
 * @param {function} [opts.onCycleComplete]
 */
export function createHnfAutopilotPanel({ brief: briefIn, viewData, intelNavigate, onCycleComplete } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-ap';

  const bar = document.createElement('div');
  bar.className = 'hnf-ap__bar';
  bar.innerHTML = `
    <div class="hnf-ap__brand">
      <span class="hnf-ap__pulse" aria-hidden="true"></span>
      <div>
        <p class="hnf-ap__eyebrow">HNF Autopilot</p>
        <h3 class="hnf-ap__title">Ejecución asistida · bajo control</h3>
      </div>
    </div>
    <span class="hnf-ap__ver muted">v${HNF_AUTOPILOT_VERSION}</span>
  `;

  const sub = document.createElement('p');
  sub.className = 'hnf-ap__sub muted';
  sub.textContent =
    'Lee el brief operativo (Intel + Flow), clasifica acciones, ejecuta solo lo seguro en este navegador y deja lo sensible para tu aprobación. Sin envío real de correo ni WhatsApp.';

  const actions = document.createElement('div');
  actions.className = 'hnf-ap__toolbar';
  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'hnf-ap__btn hnf-ap__btn--primary';
  runBtn.textContent = 'Ejecutar ciclo autopilot';
  actions.append(runBtn);

  const grid = document.createElement('div');
  grid.className = 'hnf-ap__grid';

  const mkCol = (title, hint) => {
    const col = document.createElement('section');
    col.className = 'hnf-ap__col';
    const h = document.createElement('h4');
    h.className = 'hnf-ap__col-title';
    h.textContent = title;
    const p = document.createElement('p');
    p.className = 'hnf-ap__col-hint muted';
    p.textContent = hint;
    const body = document.createElement('div');
    body.className = 'hnf-ap__col-body';
    col.append(h, p, body);
    return { col, body };
  };

  const c1 = mkCol('Ejecutadas automáticamente', 'Flags internos, priorización y recordatorios (no destructivos)');
  const c2 = mkCol('Esperando tu aprobación', 'Pasos sensibles en ERP — vos decidís antes de ejecutar asistido');
  const c3 = mkCol('Notificaciones internas', 'Riesgos y recomendaciones informativas');
  const c4 = mkCol('Resumen del ciclo', 'Qué hizo, qué no tocó');

  grid.append(c1.col, c2.col, c3.col, c4.col);

  const timeShield = document.createElement('div');
  timeShield.className = 'hnf-ap__shield';
  timeShield.innerHTML = `
    <div>
      <p class="hnf-ap__shield-k">Tiempo protegido (estimado)</p>
      <p class="hnf-ap__shield-v" id="hnf-ap-shield-val">—</p>
      <p class="hnf-ap__shield-note muted" id="hnf-ap-shield-note"></p>
    </div>
    <ul class="hnf-ap__shield-stats muted" id="hnf-ap-shield-stats"></ul>
  `;

  wrap.append(bar, sub, actions, grid, timeShield);

  const renderMetrics = () => {
    const m = getAutopilotMetrics();
    const min = m.tiempoProtegidoMinutosEstimado;
    const h = Math.floor(min / 60);
    const mm = min % 60;
    const val = h > 0 ? `~${h} h ${mm} min` : `~${mm} min`;
    timeShield.querySelector('#hnf-ap-shield-val').textContent = val;
    timeShield.querySelector('#hnf-ap-shield-note').textContent = m.notaTiempo;
    const ul = timeShield.querySelector('#hnf-ap-shield-stats');
    ul.innerHTML = '';
    [
      ['Acciones automáticas acumuladas', m.autoEjecutadas],
      ['Escaladas a aprobación (acum.)', m.escaladasAprobacion],
      ['Solo aviso (acum.)', m.soloAviso],
      ['Ciclos ejecutados', m.ciclos],
    ].forEach(([k, v]) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${v}</strong> · ${k}`;
      ul.append(li);
    });
  };

  const renderLists = () => {
    const last = getLastAutopilotCycle();
    c1.body.innerHTML = '';
    c3.body.innerHTML = '';
    c4.body.innerHTML = '';

    if (last?.ejecutadas?.length) {
      const ul = document.createElement('ul');
      ul.className = 'hnf-ap__ul';
      last.ejecutadas.forEach((e) => {
        const li = document.createElement('li');
        li.textContent = `${e.tipo}: ${e.detalle}`;
        ul.append(li);
      });
      c1.body.append(ul);
    } else {
      c1.body.innerHTML = '<p class="muted">Aún no hay ciclo en esta sesión. Ejecutá «Ejecutar ciclo autopilot».</p>';
    }

    if (last?.notificaciones?.length) {
      const ul = document.createElement('ul');
      ul.className = 'hnf-ap__ul';
      last.notificaciones.forEach((n) => {
        const li = document.createElement('li');
        li.textContent = n.texto;
        ul.append(li);
      });
      c3.body.append(ul);
    } else {
      c3.body.innerHTML = '<p class="muted">Sin avisos en el último ciclo.</p>';
    }

    if (last?.resumen) {
      const r = last.resumen;
      const ul = document.createElement('ul');
      ul.className = 'hnf-ap__ul';
      [
        `Momento: ${fmtTime(r.at)}`,
        `Automáticas: ${r.ejecutadas}`,
        `Avisos: ${r.notificaciones}`,
        `Pendientes aprobación (total cola): ${r.pendientesAprobacion}`,
        `Nuevas escalaciones en este ciclo: ${r.nuevasEscalaciones ?? '—'}`,
      ].forEach((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.append(li);
      });
      c4.body.append(ul);
      if (r.noToca?.length) {
        const nh = document.createElement('p');
        nh.className = 'hnf-ap__notouch-title';
        nh.textContent = 'Decidió no tocar (por diseño)';
        const nu = document.createElement('ul');
        nu.className = 'hnf-ap__ul hnf-ap__ul--dim';
        r.noToca.forEach((t) => {
          const li = document.createElement('li');
          li.textContent = t;
          nu.append(li);
        });
        c4.body.append(nh, nu);
      }
    } else {
      c4.body.innerHTML = '<p class="muted">Sin resumen aún.</p>';
    }

    c2.body.innerHTML = '';
    const pending = listPendingApprovals();
    if (!pending.length) {
      c2.body.innerHTML = '<p class="muted">Nada pendiente de aprobación en la cola local.</p>';
      return;
    }
    pending.slice(0, 12).forEach((p) => {
      const card = document.createElement('article');
      card.className = 'hnf-ap__pending';
      card.innerHTML = `
        <p class="hnf-ap__pending-acc">${p.accion}</p>
        <p class="hnf-ap__pending-desc muted">${p.descripcion}</p>
        <p class="hnf-ap__pending-meta"><span class="hnf-ap__tag">${p.riesgo}</span> · ${p.impacto}</p>
      `;
      const row = document.createElement('div');
      row.className = 'hnf-ap__pending-actions';
      const bNav = document.createElement('button');
      bNav.type = 'button';
      bNav.className = 'hnf-ap__btn hnf-ap__btn--ghost';
      bNav.textContent = 'Abrir en ERP';
      bNav.addEventListener('click', () => p.nav && intelNavigate?.(p.nav));
      const bOk = document.createElement('button');
      bOk.type = 'button';
      bOk.className = 'hnf-ap__btn hnf-ap__btn--ok';
      bOk.textContent = 'Aprobar';
      bOk.addEventListener('click', () => {
        const actor = getStoredOperatorName() || 'operador';
        approveAutopilotAction(p.id, actor);
        renderLists();
        renderMetrics();
      });
      const bNo = document.createElement('button');
      bNo.type = 'button';
      bNo.className = 'hnf-ap__btn hnf-ap__btn--no';
      bNo.textContent = 'Rechazar';
      bNo.addEventListener('click', () => {
        const actor = getStoredOperatorName() || 'operador';
        rejectAutopilotAction(p.id, actor);
        renderLists();
        renderMetrics();
      });
      row.append(bNav, bOk, bNo);
      card.append(row);
      c2.body.append(card);
    });
  };

  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    const brief = briefIn || getDirectorOperationalBrief(viewData || {});
    try {
      runAutopilotCycle(brief, viewData || null);
      renderLists();
      renderMetrics();
      onCycleComplete?.(getLastAutopilotCycle());
    } finally {
      runBtn.disabled = false;
    }
  });

  renderLists();
  renderMetrics();

  return wrap;
}
