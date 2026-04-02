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
  if (x === 'alta') return 'hnf-skb__pri hnf-skb__pri--alta';
  if (x === 'baja') return 'hnf-skb__pri hnf-skb__pri--baja';
  return 'hnf-skb__pri hnf-skb__pri--media';
}

function estadoLabel(ot) {
  return String(ot?.estado || '—')
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Kanban 4 columnas — cards mínimas, drag & drop.
 * @param {object} options
 * @param {object[]} options.ots
 * @param {(ot: object, shell: HTMLElement) => void} [options.onSelectOt]
 * @param {(ot: object, shell: HTMLElement) => void} [options.onDetail]
 * @param {(ot: object, targetLaneId: string) => void} [options.onDropOnLane]
 */
export function createSimpleKanbanBoard(options) {
  const { ots = [], onSelectOt, onDetail, onDropOnLane } = options;

  const root = el('hnf-skb');
  let selectedShell = null;

  const setActiveShell = (shell) => {
    if (selectedShell) selectedShell.classList.remove('hnf-skb__card--active');
    selectedShell = shell;
    if (selectedShell) selectedShell.classList.add('hnf-skb__card--active');
  };

  const byLane = Object.fromEntries(SIMPLE_LANE_IDS.map((k) => [k, []]));
  for (const ot of ots) {
    const lane = mapOtToSimpleLane(ot);
    (byLane[lane] || byLane.simp_ingreso).push(ot);
  }

  const lanesEl = el('hnf-skb__lanes');

  SIMPLE_LANE_IDS.forEach((laneId) => {
    const lane = el('hnf-skb__lane');
    const head = el('hnf-skb__lane-head');
    const title = el('hnf-skb__lane-title');
    title.textContent = SIMPLE_LANE_LABELS[laneId] || laneId;
    const count = el('hnf-skb__lane-count');
    count.textContent = String((byLane[laneId] || []).length);
    head.append(title, count);

    const cards = el('hnf-skb__cards');
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
      const shell = el('hnf-skb__card');
      if (typeof onDropOnLane === 'function') {
        shell.setAttribute('draggable', 'true');
        shell.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/hnf-ot', JSON.stringify({ id: ot.id }));
          e.dataTransfer.effectAllowed = 'move';
        });
      }

      const main = el('hnf-skb__card-main', 'button');
      main.type = 'button';

      const cliente = el('hnf-skb__card-cliente');
      cliente.textContent = String(ot.cliente || '').trim() || 'Sin cliente';

      const meta = el('hnf-skb__card-meta');
      const tipo = el('hnf-skb__card-tipo');
      tipo.textContent = String(ot.tipoServicio || '—');
      const st = el('hnf-skb__card-estado');
      st.textContent = estadoLabel(ot);
      meta.append(tipo, st);

      const pri = el(priClass(ot.prioridadOperativa || ot.prioridadSugerida));
      pri.textContent = String(ot.prioridadOperativa || ot.prioridadSugerida || 'media').toUpperCase();

      const idRow = el('hnf-skb__card-id');
      idRow.textContent = String(ot.id || '');

      main.append(cliente, meta, pri, idRow);
      main.addEventListener('click', () => {
        setActiveShell(shell);
        onSelectOt?.(ot, shell);
      });

      const open = el('hnf-skb__card-open', 'button');
      open.type = 'button';
      open.textContent = 'Abrir';
      open.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveShell(shell);
        onSelectOt?.(ot, shell);
        onDetail?.(ot, shell);
      });

      shell.append(main, open);
      cards.append(shell);
    }

    lane.append(head, cards);
    lanesEl.append(lane);
  });

  root.append(lanesEl);
  return { element: root, setActiveShell };
}
