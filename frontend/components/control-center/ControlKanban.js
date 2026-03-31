/**
 * Contenedor visual dominante para el tablero Kanban (Mando).
 */
export function createControlKanbanRegion({ boardElement }) {
  const root = document.createElement('div');
  root.className = 'hnf-cc-kanban-shell';
  root.setAttribute('aria-label', 'Kanban operativo');

  const chrome = document.createElement('div');
  chrome.className = 'hnf-cc-kanban-shell__chrome';

  const title = document.createElement('h2');
  title.className = 'hnf-cc-kanban-shell__title';
  title.textContent = 'Flujo operativo en vivo';

  const sub = document.createElement('p');
  sub.className = 'hnf-cc-kanban-shell__sub';
  sub.textContent =
    'Estados de OT en columnas. La tarjeta activa alimenta el núcleo Jarvis lateral — cockpit unificado.';

  chrome.append(title, sub);

  const stage = document.createElement('div');
  stage.className = 'hnf-cc-kanban-shell__stage';
  stage.append(boardElement);

  root.append(chrome, stage);
  return root;
}
