import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { KANBAN_LANE_IDS, mapOtToLane } from './mapOtToLane.js';
import { OtCard } from './OtCard.jsx';

const LANE_LABEL = {
  ingreso: 'Ingreso',
  en_proceso: 'En proceso',
  pendiente_aprobacion: 'Pend. aprobación',
  observado: 'Observado',
  aprobado: 'Aprobado',
  enviado: 'Enviado',
  cerrado: 'Cerrado',
};

/**
 * Desktop: columnas con scroll horizontal + scroll Y por columna (acotado).
 * Mobile: snap horizontal — una columna por viewport; dots + flechas como acción rápida.
 */
export function KanbanBoard({ ots = [], selectedId, onSelectOt, alertaOpts }) {
  const scrollerRef = useRef(null);
  const [mobileLane, setMobileLane] = useState(0);

  const byLane = useMemo(() => {
    const m = Object.fromEntries(KANBAN_LANE_IDS.map((k) => [k, []]));
    for (const ot of ots) {
      const lane = mapOtToLane(ot);
      if (m[lane]) m[lane].push(ot);
      else m.ingreso.push(ot);
    }
    return m;
  }, [ots]);

  const scrollToLaneIndex = useCallback((idx) => {
    const i = Math.max(0, Math.min(KANBAN_LANE_IDS.length - 1, idx));
    setMobileLane(i);
    const root = scrollerRef.current;
    const col = root?.children[i];
    col?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, []);

  const onScrollerScroll = useCallback(() => {
    const root = scrollerRef.current;
    if (!root || root.scrollWidth <= root.clientWidth) return;
    const w = root.clientWidth;
    const idx = Math.round(root.scrollLeft / w);
    if (idx !== mobileLane && idx >= 0 && idx < KANBAN_LANE_IDS.length) setMobileLane(idx);
  }, [mobileLane]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/90 px-2 py-1.5 md:px-3">
        <p className="text-[0.55rem] font-bold uppercase tracking-wider text-zinc-500">OT</p>
        <p className="text-[0.55rem] tabular-nums text-zinc-600">{ots.length}</p>
      </div>

      {/* Mobile: columna activa + controles (acción primero) */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-950/50 px-2 py-1.5 md:hidden">
        <button
          type="button"
          onClick={() => scrollToLaneIndex(mobileLane - 1)}
          disabled={mobileLane <= 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 disabled:opacity-30"
          aria-label="Columna anterior"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[0.72rem] font-semibold text-zinc-200">
          {LANE_LABEL[KANBAN_LANE_IDS[mobileLane]]}
        </p>
        <button
          type="button"
          onClick={() => scrollToLaneIndex(mobileLane + 1)}
          disabled={mobileLane >= KANBAN_LANE_IDS.length - 1}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 disabled:opacity-30"
          aria-label="Columna siguiente"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div className="flex shrink-0 justify-center gap-1 py-1.5 md:hidden">
        {KANBAN_LANE_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollToLaneIndex(i)}
            className={[
              'h-1.5 min-w-1.5 rounded-full transition-all',
              i === mobileLane ? 'w-5 bg-cyan-500/90' : 'w-1.5 bg-zinc-700',
            ].join(' ')}
            title={LANE_LABEL[id]}
            aria-label={LANE_LABEL[id]}
            aria-current={i === mobileLane ? 'true' : undefined}
          />
        ))}
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScrollerScroll}
        className="flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 pb-2 pt-1 md:pt-2 snap-x snap-mandatory md:snap-none"
      >
        {KANBAN_LANE_IDS.map((laneId) => {
          const list = byLane[laneId] || [];
          return (
            <section
              key={laneId}
              className="flex min-h-0 w-[calc(100vw-1rem)] max-w-[min(100vw-1rem,28rem)] shrink-0 snap-center snap-always flex-col rounded-xl border border-zinc-800/90 bg-zinc-950/60 md:max-w-none md:w-[176px] lg:w-[188px]"
            >
              <div className="hidden shrink-0 border-b border-zinc-800/80 px-2 py-1.5 md:block">
                <h2 className="text-[0.58rem] font-bold uppercase tracking-wide text-zinc-400">
                  {LANE_LABEL[laneId]}
                </h2>
                <p className="text-[0.5rem] tabular-nums text-zinc-600">{list.length}</p>
              </div>
              <div className="hnf-lane-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-1.5 py-2">
                {list.map((ot) => (
                  <OtCard
                    key={String(ot.id)}
                    ot={ot}
                    active={String(ot.id) === String(selectedId)}
                    onSelect={onSelectOt}
                    alertaOpts={alertaOpts}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
