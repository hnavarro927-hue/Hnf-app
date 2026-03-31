import '../styles/hnf-operational-kanban.css';
import { buildJarvisDecisionCard } from './jarvis-decision-card.js';

/**
 * Panel lateral con decisión Jarvis para la OT seleccionada.
 * @returns {{ element: HTMLElement, setOt: (ot: object | null) => void }}
 */
export function createJarvisPanel() {
  const root = document.createElement('aside');
  root.className = 'hnf-jarvis-panel';
  root.setAttribute('aria-label', 'Panel Jarvis');

  const head = document.createElement('div');
  head.className = 'hnf-jarvis-panel__head';
  head.textContent = 'Jarvis';

  const body = document.createElement('div');
  body.className = 'hnf-jarvis-panel__body';

  const empty = document.createElement('p');
  empty.className = 'hnf-jarvis-panel__empty';
  empty.textContent = 'Seleccioná una OT en el tablero para ver la decisión de Jarvis.';

  body.append(empty);
  root.append(head, body);

  function setOt(ot) {
    body.replaceChildren();
    if (!ot || typeof ot !== 'object') {
      const p = document.createElement('p');
      p.className = 'hnf-jarvis-panel__empty';
      p.textContent = 'Seleccioná una OT en el tablero para ver la decisión de Jarvis.';
      body.append(p);
      return;
    }
    body.append(buildJarvisDecisionCard(ot, { variant: 'full' }));
  }

  return { element: root, setOt };
}
