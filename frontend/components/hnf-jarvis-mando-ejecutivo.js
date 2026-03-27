/**
 * Franja superior Jarvis — alerta · modo · acción (sin bloques legacy).
 */

import { getControlState, setMode } from '../domain/jarvis-control-center.js';

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

/**
 * @param {object} opts
 * @param {object} opts.model - buildExecutiveCommandModel
 * @param {function} [opts.intelNavigate]
 * @param {function} [opts.navigateToView]
 */
export function createHnfExecutiveMandoStrip({ model, intelNavigate, navigateToView } = {}) {
  const m = model && typeof model === 'object' ? model : {};
  const el = document.createElement('header');
  el.className = 'hnf-ai-strip';
  el.setAttribute('aria-label', 'Estado rápido');

  const alerts = Array.isArray(m.alertasEjecutivas) ? m.alertasEjecutivas : [];
  const first = alerts[0];
  let alertText = first ? `${first.titulo}: ${truncate(first.detalle, 72)}` : truncate(m.principalProblema, 88);
  if (!alertText) alertText = 'Sin alertas prioritarias.';

  const alertCol = document.createElement('div');
  alertCol.className = 'hnf-ai-strip__alert';
  const alertP = document.createElement('p');
  alertP.className = 'hnf-ai-strip__alert-text';
  alertP.textContent = alertText;
  alertCol.append(alertP);
  if (first?.nav?.view) {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'hnf-ai-strip__link';
    go.textContent = 'Ver';
    go.addEventListener('click', () => {
      if (typeof intelNavigate === 'function') intelNavigate(first.nav);
      else if (typeof navigateToView === 'function') navigateToView(first.nav.view);
    });
    alertCol.append(go);
  }

  const modeCol = document.createElement('div');
  modeCol.className = 'hnf-ai-strip__modes';
  const modeLab = document.createElement('span');
  modeLab.className = 'hnf-ai-strip__modes-label';
  modeLab.textContent = 'Modo';
  const chips = document.createElement('div');
  chips.className = 'hnf-ai-strip__chips';
  const modeMap = [
    { key: 'autonomic_safe', label: 'Auto' },
    { key: 'assist', label: 'Asistido' },
    { key: 'observe', label: 'Manual' },
  ];
  const syncChips = () => {
    const { jarvisMode } = getControlState();
    const effective = jarvisMode === 'off' ? 'observe' : jarvisMode;
    chips.querySelectorAll('.hnf-ai-strip__chip').forEach((b) => {
      b.classList.toggle('hnf-ai-strip__chip--on', b.dataset.mode === effective);
    });
  };
  for (const x of modeMap) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-ai-strip__chip';
    b.dataset.mode = x.key;
    b.textContent = x.label;
    b.addEventListener('click', () => {
      setMode(x.key);
      syncChips();
    });
    chips.append(b);
  }
  syncChips();
  modeCol.append(modeLab, chips);

  const actCol = document.createElement('div');
  actCol.className = 'hnf-ai-strip__action';
  const actBtn = document.createElement('button');
  actBtn.type = 'button';
  actBtn.className = 'hnf-ai-strip__act';
  actBtn.textContent = 'Siguiente paso';
  actBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('hnf-jarvis-primary-action'));
  });
  actCol.append(actBtn);

  el.append(alertCol, modeCol, actCol);
  return el;
}
