import { buildDisciplinaTecnicosSnapshot } from '../domain/hnf-tecnico-evidencia-disciplina.js';

const pct = (n) => (n == null ? '—' : `${n}%`);

/**
 * Panel: tabla por técnico + alertas de bajo cumplimiento (evidencia Clima).
 */
export function createHnfDisciplinaTecnicosPanel(ots, { navigateToView, variant = 'default' } = {}) {
  const wrap = document.createElement('div');
  wrap.className =
    variant === 'compact' ? 'hnf-disciplina hnf-disciplina--compact' : 'hnf-disciplina';

  const snap = buildDisciplinaTecnicosSnapshot(ots);

  const head = document.createElement('div');
  head.className = 'hnf-disciplina__head';
  const h = document.createElement('h2');
  h.className = 'hnf-disciplina__title';
  h.textContent = 'Disciplina técnica (evidencia Clima)';
  const sub = document.createElement('p');
  sub.className = 'hnf-disciplina__sub muted small';
  sub.textContent =
    'OT Clima con técnico asignado. Completa = fotos antes, durante y después en cada equipo (o en la visita general si no hay equipos). Misma regla que el cierre de OT.';
  head.append(h, sub);
  wrap.append(head);

  const glob = document.createElement('div');
  glob.className = 'hnf-disciplina__global';
  if (snap.global.totalOts === 0) {
    glob.append(
      Object.assign(document.createElement('p'), {
        className: 'muted small',
        textContent: 'No hay OT Clima con técnico asignado para evaluar.',
      })
    );
    wrap.append(glob);
    return wrap;
  }
  glob.innerHTML = `<span class="hnf-disciplina__global-k">Cumplimiento global</span> <strong class="hnf-disciplina__global-v">${pct(snap.global.porcentajeCumplimiento)}</strong> <span class="muted small">(${snap.global.completas} completas / ${snap.global.totalOts} OT)</span>`;
  wrap.append(glob);

  if (snap.alertasBajoCumplimiento.length) {
    const alertBox = document.createElement('div');
    alertBox.className = 'hnf-disciplina__alertas';
    alertBox.setAttribute('role', 'status');
    const ah = document.createElement('p');
    ah.className = 'hnf-disciplina__alertas-title';
    ah.textContent = 'Atención: bajo cumplimiento de evidencia';
    const ul = document.createElement('ul');
    ul.className = 'hnf-disciplina__alertas-ul';
    for (const a of snap.alertasBajoCumplimiento) {
      const li = document.createElement('li');
      li.textContent = `${a.tecnico}: ${pct(a.porcentajeCumplimiento)} en ${a.total} OT (alerta si < ${snap.params.lowComplianceThresholdPct}% y ≥${snap.params.minOtsForAlert} OT)`;
      ul.append(li);
    }
    alertBox.append(ah, ul);
    wrap.append(alertBox);
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = 'hnf-disciplina__table-wrap';
  const table = document.createElement('table');
  table.className = 'hnf-disciplina__table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Técnico</th>
        <th>OT totales</th>
        <th>Completas</th>
        <th>Incompletas</th>
        <th>Cumplimiento</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tb = table.querySelector('tbody');
  for (const r of snap.rows) {
    const tr = document.createElement('tr');
    const low =
      r.total >= snap.params.minOtsForAlert &&
      r.porcentajeCumplimiento != null &&
      r.porcentajeCumplimiento < snap.params.lowComplianceThresholdPct;
    if (low) tr.classList.add('hnf-disciplina__row--warn');
    tr.innerHTML = `
      <td>${escapeHtml(r.tecnico)}</td>
      <td>${r.total}</td>
      <td>${r.completas}</td>
      <td>${r.incompletas}</td>
      <td><strong>${pct(r.porcentajeCumplimiento)}</strong></td>
    `;
    tb.append(tr);
  }
  tableWrap.append(table);
  wrap.append(tableWrap);

  if (navigateToView && variant !== 'compact') {
    const foot = document.createElement('div');
    foot.className = 'hnf-disciplina__foot';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button';
    b.textContent = 'Ir a Clima (ejecución OT)';
    b.addEventListener('click', () => navigateToView('clima'));
    foot.append(b);
    wrap.append(foot);
  }

  return wrap;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
