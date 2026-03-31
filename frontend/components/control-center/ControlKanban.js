/**
 * Contenedor visual dominante para el tablero Kanban (Mando).
 */
export function createControlKanbanRegion({ boardElement }) {
  const root = document.createElement('div');
  root.className = 'hnf-cc-kanban-shell';
  root.setAttribute('aria-label', 'Kanban operativo');

  const chrome = document.createElement('div');
  chrome.className = 'hnf-cc-kanban-shell__chrome';

  const rail = document.createElement('div');
  rail.className = 'hnf-cc-kanban-shell__accent-rail';
  rail.setAttribute('aria-hidden', 'true');

  const head = document.createElement('div');
  head.className = 'hnf-cc-kanban-shell__head';

  const title = document.createElement('h2');
  title.className = 'hnf-cc-kanban-shell__title';
  title.textContent = 'Flujo operativo en vivo';

  const sub = document.createElement('p');
  sub.className = 'hnf-cc-kanban-shell__sub';
  sub.textContent =
    'Columnas por estado · tarjeta activa alimenta el núcleo Jarvis · arquitectura de mando unificado.';

  const meta = document.createElement('div');
  meta.className = 'hnf-cc-kanban-shell__meta';
  meta.innerHTML =
    '<span class="hnf-cc-kanban-shell__meta-item"><strong>Modo</strong> Cockpit</span><span class="hnf-cc-kanban-shell__meta-item"><strong>Vista</strong> Operativa</span>';

  head.append(title, sub, meta);
  chrome.append(rail, head);

  const stage = document.createElement('div');
  stage.className = 'hnf-cc-kanban-shell__stage';
  stage.append(boardElement);

  root.append(chrome, stage);
  return root;
}
