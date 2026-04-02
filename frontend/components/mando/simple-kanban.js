import {
  SIMPLE_LANE_IDS,
  SIMPLE_LANE_LABELS,
  mapOtToSimpleLane,
} from '../../domain/ot-simple-kanban-lanes.js';

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function priClass(p) {
  const x = String(p || '').toLowerCase();
  if (x === 'alta') return 'hnf-ctl-kb__pri hnf-ctl-kb__pri--alta';
  if (x === 'baja') return 'hnf-ctl-kb__pri hnf-ctl-kb__pri--baja';
  return 'hnf-ctl-kb__pri hnf-ctl-kb__pri--media';
}

/**
 * Kanban operativo 4 columnas — tarjeta: cliente, tipo, prioridad, acción.
 * @param {object} options
 * @param {object[]} options.ots
 * @param {(ot: object, shell: HTMLElement) => void} [options.onOpenOt]
 * @param {(ot: object, targetLaneId: string) => void} [options.onDropOnLane]
 */
export function createSimpleKanbanBoard(options) {
  const { ots = [], onOpenOt, onDropOnLane } = options;

  const root = el('hnf-ctl-kb');
  let selectedShell = null;

  const setActiveShell = (shell) => {
    if (selectedShell) selectedShell.classList.remove('hnf-ctl-kb__card--active');
    selectedShell = shell;
    if (selectedShell) selectedShell.classList.add('hnf-ctl-kb__card--active');
  };

  const byLane = Object.fromEntries(SIMPLE_LANE_IDS.map((k) => [k, []]));
  for (const ot of ots) {
    const lane = mapOtToSimpleLane(ot);
    (byLane[lane] || byLane.simp_ingreso).push(ot);
  }

  const lanesEl = el('hnf-ctl-kb__lanes');

  SIMPLE_LANE_IDS.forEach((laneId) => {
    const lane = el('hnf-ctl-kb__lane');
    const head = el('hnf-ctl-kb__lane-head');
    const title = el('hnf-ctl-kb__lane-title');
    title.textContent = SIMPLE_LANE_LABELS[laneId] || laneId;
    const count = el('hnf-ctl-kb__lane-count');
    count.textContent = String((byLane[laneId] || []).length);
    head.append(title, count);

    const cards = el('hnf-ctl-kb__cards');
    if (typeof onDropOnLane === 'function') {
      cards.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      cards.addEventListener('drop', (e) => {
        e.preventDefault();
        let payload = null;
        try {
          payload = JSON.parse(e.dataTransfer.getData('application/hnf-ot') || 'null');
        } catch {
          payload = null;
        }
        const oid = payload?.id;
        if (oid == null) return;
        const dropped = ots.find((x) => String(x?.id) === String(oid));
        if (dropped) onDropOnLane(dropped, laneId);
      });
    }

    for (const ot of byLane[laneId] || []) {
      const shell = el('hnf-ctl-kb__card');
      if (typeof onDropOnLane === 'function') {
        shell.setAttribute('draggable', 'true');
        shell.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/hnf-ot', JSON.stringify({ id: ot.id }));
          e.dataTransfer.effectAllowed = 'move';
        });
      }

      const cliente = el('hnf-ctl-kb__cliente');
      cliente.textContent = String(ot.cliente || '').trim() || 'Sin cliente';

      const tipo = el('hnf-ctl-kb__tipo');
      tipo.textContent = String(ot.tipoServicio || '—');

      const pri = el(priClass(ot.prioridadOperativa || ot.prioridadSugerida));
      pri.textContent = String(ot.prioridadOperativa || ot.prioridadSugerida || 'media').toUpperCase();

      const act = el('hnf-ctl-kb__action', 'button');
      act.type = 'button';
      act.textContent = 'Abrir';
      act.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveShell(shell);
        onOpenOt?.(ot, shell);
      });

      shell.addEventListener('click', (e) => {
        if (e.target === act) return;
        setActiveShell(shell);
        onOpenOt?.(ot, shell);
      });

      shell.append(cliente, tipo, pri, act);
      cards.append(shell);
    }

    lane.append(head, cards);
    lanesEl.append(lane);
  });

  root.append(lanesEl);
  return { element: root, setActiveShell };
}
