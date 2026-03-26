/**
 * Barra compacta sobre el mando Jarvis — solo jerarquía visual (estado, modo, alerta).
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function estadoGeneralTone(m) {
  const c = m.centro || {};
  if ((m.otCriticas ?? 0) > 0) return 'crit';
  if ((c.requiereValidacion ?? 0) > 0 || (m.pendienteAprobacion ?? 0) > 0) return 'warn';
  return 'ok';
}

function estadoGeneralLabel(m) {
  const t = estadoGeneralTone(m);
  if (t === 'crit') return 'Atención inmediata';
  if (t === 'warn') return 'Revisión pendiente';
  return 'Operación estable';
}

/**
 * @param {object} opts
 * @param {object} opts.model - Salida de buildExecutiveCommandModel
 * @param {function} [opts.intelNavigate]
 * @param {function} [opts.navigateToView]
 */
export function createHnfExecutiveMandoStrip({ model, intelNavigate, navigateToView } = {}) {
  const m = model && typeof model === 'object' ? model : {};
  const el = document.createElement('section');
  el.className = 'hnf-exec-mando hnf-exec-mando--compact';
  el.setAttribute('aria-label', 'Estado del mando');

  const row = document.createElement('div');
  row.className = 'hnf-exec-mando__compact-row';

  const est = document.createElement('div');
  est.className = `hnf-exec-mando__compact-estado hnf-exec-mando__compact-estado--${estadoGeneralTone(m)}`;
  est.innerHTML = `<span class="hnf-exec-mando__compact-estado-tag">${esc(estadoGeneralLabel(m))}</span>
    <span class="hnf-exec-mando__compact-estado-line">${esc(truncate(m.principalProblema, 96))}</span>`;

  const mod = document.createElement('div');
  mod.className = 'hnf-exec-mando__compact-modo';
  mod.innerHTML = `<span class="hnf-exec-mando__compact-modo-k">Modo</span>
    <span class="hnf-exec-mando__compact-modo-v">${esc(m.decisionMode?.label || 'Asistido')}</span>`;

  const alerts = Array.isArray(m.alertasEjecutivas) ? m.alertasEjecutivas : [];
  const first = alerts[0];
  const alerta = document.createElement('div');
  alerta.className = 'hnf-exec-mando__compact-alerta';
  if (first) {
    alerta.innerHTML = `<span class="hnf-exec-mando__compact-alerta-k">Alerta</span>
      <span class="hnf-exec-mando__compact-alerta-v">${esc(truncate(`${first.titulo}: ${first.detalle}`, 120))}</span>`;
    if (first.nav?.view) {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'hnf-exec-mando__compact-alerta-go';
      go.textContent = 'Abrir';
      go.addEventListener('click', () => {
        if (typeof intelNavigate === 'function') intelNavigate(first.nav);
        else if (typeof navigateToView === 'function') navigateToView(first.nav.view);
      });
      alerta.append(go);
    }
  } else {
    alerta.innerHTML = `<span class="hnf-exec-mando__compact-alerta-k">Alerta</span>
      <span class="hnf-exec-mando__compact-alerta-v hnf-exec-mando__compact-alerta-v--ok">Sin alertas prioritarias en este corte.</span>`;
  }

  row.append(est, mod, alerta);
  el.append(row);
  return el;
}
