import '../styles/hnf-operational-kanban.css';
import { KANBAN_LANE_IDS, getEffectiveEstadoOperativo, mapOtToLane } from '../domain/ot-kanban-lanes.js';

export const DEFAULT_KANBAN_LANE_LABELS = {
  ingreso: 'Ingreso',
  en_proceso: 'En proceso',
  pendiente_aprobacion: 'Pendiente aprobación',
  observado: 'Observado',
  aprobado: 'Aprobado (Lyn)',
  enviado: 'Enviado cliente',
  cerrado: 'Cerrado',
};

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function tipoClass(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'clima') return 'hnf-kb__card--clima';
  if (t === 'flota') return 'hnf-kb__card--flota';
  return '';
}

function prioridadChipClass(p) {
  const x = String(p || '').toLowerCase();
  if (x === 'alta') return 'hnf-kb__chip--pri-alta';
  if (x === 'media') return 'hnf-kb__chip--pri-media';
  if (x === 'baja') return 'hnf-kb__chip--pri-baja';
  return '';
}

function techLabel(ot) {
  return (
    String(ot?.tecnicoAsignado ?? ot?.responsableActual ?? '')
      .trim() || '—'
  );
}

/**
 * @param {object} options
 * @param {object[]} options.ots
 * @param {Record<string, string>} [options.laneLabels]
 * @param {(ot: object, shell: HTMLElement) => void} [options.onSelectOt]
 * @param {(ot: object) => void} [options.onAssignTech]
 * @param {(ot: object) => void} [options.onChangeState]
 * @param {(ot: object, shell: HTMLElement) => void} [options.onDetail]
 * @param {(ot: object, targetLaneId: string) => void} [options.onDropOnLane]
 * @returns {{ element: HTMLElement, setActiveShell: (shell: HTMLElement | null) => void }}
 */
export function createKanbanBoard(options) {
  const {
    ots = [],
    laneLabels = DEFAULT_KANBAN_LANE_LABELS,
    onSelectOt,
    onAssignTech,
    onChangeState,
    onDetail,
    onDropOnLane,
  } = options;

  const root = el('hnf-kb');
  let selectedShell = null;

  const setActiveShell = (shell) => {
    if (selectedShell) selectedShell.classList.remove('hnf-kb__card--active');
    selectedShell = shell;
    if (selectedShell) selectedShell.classList.add('hnf-kb__card--active');
  };

  const byLane = Object.fromEntries(KANBAN_LANE_IDS.map((k) => [k, []]));
  for (const ot of ots) {
    const lane = mapOtToLane(ot);
    if (byLane[lane]) byLane[lane].push(ot);
    else byLane.ingreso.push(ot);
  }

  let mobileLane = 0;
  const lanesEl = el('hnf-kb__lanes');

  const mobileNav = el('hnf-kb__mobile-nav');
  const prevB = el('hnf-op-btn', 'button');
  prevB.type = 'button';
  prevB.textContent = '◀';
  const mobileTitle = el('hnf-op-header__title', 'span');
  mobileTitle.style.flex = '1';
  mobileTitle.style.textAlign = 'center';
  mobileTitle.style.fontSize = '0.65rem';
  const nextB = el('hnf-op-btn', 'button');
  nextB.type = 'button';
  nextB.textContent = '▶';
  mobileNav.append(prevB, mobileTitle, nextB);

  const dots = el('hnf-kb__dots');

  const scrollToLane = (idx) => {
    const i = Math.max(0, Math.min(KANBAN_LANE_IDS.length - 1, idx));
    mobileLane = i;
    const col = lanesEl.children[i];
    col?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    mobileTitle.textContent = laneLabels[KANBAN_LANE_IDS[i]] || KANBAN_LANE_IDS[i];
    prevB.disabled = i <= 0;
    nextB.disabled = i >= KANBAN_LANE_IDS.length - 1;
    dots.querySelectorAll('.hnf-kb__dot').forEach((d, di) => {
      d.classList.toggle('hnf-kb__dot--on', di === i);
    });
  };

  prevB.addEventListener('click', () => scrollToLane(mobileLane - 1));
  nextB.addEventListener('click', () => scrollToLane(mobileLane + 1));

  KANBAN_LANE_IDS.forEach((laneId, idx) => {
    const lane = el('hnf-kb__lane');
    const head = el('hnf-kb__lane-head');
    const t = el('hnf-kb__lane-title');
    t.textContent = laneLabels[laneId] || laneId;
    const c = el('hnf-kb__lane-count');
    const nLane = (byLane[laneId] || []).length;
    c.textContent = String(nLane);
    head.append(t, c);

    const cards = el('hnf-kb__lane-cards');
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
      const shell = el(`hnf-kb__card ${tipoClass(ot.tipoServicio)}`);
      if (typeof onDropOnLane === 'function') {
        shell.setAttribute('draggable', 'true');
        shell.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/hnf-ot', JSON.stringify({ id: ot.id }));
          e.dataTransfer.effectAllowed = 'move';
        });
      }
      const tap = el('hnf-kb__card-tap', 'button');
      tap.type = 'button';
      tap.setAttribute('aria-label', `Seleccionar ${String(ot.id || '')}`);

      const idEl = el('hnf-kb__card-id');
      idEl.textContent = String(ot.id || '');

      const cli = el('hnf-kb__card-cliente');
      cli.textContent = String(ot.cliente || '').trim() || '—';

      const grid = el('hnf-kb__card-grid');
      const addCell = (k, v) => {
        const kk = el('hnf-kb__card-grid-k');
        kk.textContent = k;
        const vv = el('hnf-kb__card-grid-v');
        vv.textContent = v;
        grid.append(kk, vv);
      };
      addCell('Tipo', String(ot.tipoServicio || '—'));
      addCell('Técnico', techLabel(ot));

      const chips = el('hnf-kb__card-chips');
      const pri = String(ot.prioridadOperativa || ot.prioridadSugerida || '—')
        .trim()
        .toUpperCase();
      const priEl = el(`hnf-kb__chip ${prioridadChipClass(ot.prioridadOperativa || ot.prioridadSugerida)}`);
      priEl.textContent = `P ${pri}`;
      chips.append(priEl);
      if (ot.riesgoDetectado) {
        const r = el('hnf-kb__chip hnf-kb__chip--riesgo');
        r.textContent = 'Riesgo';
        chips.append(r);
      }

      const est = el('hnf-kb__card-estado');
      const fl = getEffectiveEstadoOperativo(ot);
      est.textContent = `Flujo: ${fl}`;

      tap.append(idEl, cli, grid, chips, est);
      tap.addEventListener('click', () => {
        setActiveShell(shell);
        onSelectOt?.(ot, shell);
      });

      const actRow = el('hnf-kb__card-actions');
      const bState = el('hnf-kb__card-act', 'button');
      bState.type = 'button';
      bState.textContent = 'Cambiar estado';
      bState.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveShell(shell);
        onSelectOt?.(ot, shell);
        onChangeState?.(ot);
      });
      const bTech = el('hnf-kb__card-act hnf-kb__card-act--ghost', 'button');
      bTech.type = 'button';
      bTech.textContent = 'Asignar técnico';
      bTech.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveShell(shell);
        onSelectOt?.(ot, shell);
        onAssignTech?.(ot);
      });
      const bDet = el('hnf-kb__card-act hnf-kb__card-act--ghost', 'button');
      bDet.type = 'button';
      bDet.textContent = 'Ver detalle';
      bDet.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveShell(shell);
        onSelectOt?.(ot, shell);
        onDetail?.(ot, shell);
      });
      actRow.append(bState, bTech, bDet);

      shell.append(tap, actRow);
      cards.append(shell);
    }

    lane.append(head, cards);
    lanesEl.append(lane);

    const dot = el(idx === 0 ? 'hnf-kb__dot hnf-kb__dot--on' : 'hnf-kb__dot', 'button');
    dot.type = 'button';
    dot.setAttribute('aria-label', laneLabels[laneId] || laneId);
    dot.addEventListener('click', () => scrollToLane(idx));
    dots.append(dot);
  });

  lanesEl.addEventListener('scroll', () => {
    if (lanesEl.scrollWidth <= lanesEl.clientWidth + 8) return;
    const w = lanesEl.clientWidth || 1;
    const idx = Math.round(lanesEl.scrollLeft / w);
    if (idx !== mobileLane && idx >= 0 && idx < KANBAN_LANE_IDS.length) {
      mobileLane = idx;
      mobileTitle.textContent = laneLabels[KANBAN_LANE_IDS[idx]] || KANBAN_LANE_IDS[idx];
      prevB.disabled = idx <= 0;
      nextB.disabled = idx >= KANBAN_LANE_IDS.length - 1;
      dots.querySelectorAll('.hnf-kb__dot').forEach((d, di) => d.classList.toggle('hnf-kb__dot--on', di === idx));
    }
  });

  mobileTitle.textContent = laneLabels[KANBAN_LANE_IDS[0]] || KANBAN_LANE_IDS[0];
  prevB.disabled = true;

  root.append(mobileNav, dots, lanesEl);

  return { element: root, setActiveShell };
}
