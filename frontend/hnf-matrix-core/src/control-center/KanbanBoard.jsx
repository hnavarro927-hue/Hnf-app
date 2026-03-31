import { useMemo } from 'react';
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
 * Kanban horizontal: scroll X en el tablero; cada columna con scroll Y propio.
 * Sin mezclar operaciones por tipo: cada card muestra su tipoServicio.
 */
export function KanbanBoard({ ots = [], selectedId, onSelectOt }) {
  const byLane = useMemo(() => {
    const m = Object.fromEntries(KANBAN_LANE_IDS.map((k) => [k, []]));
    for (const ot of ots) {
      const lane = mapOtToLane(ot);
      if (m[lane]) m[lane].push(ot);
      else m.ingreso.push(ot);
    }
    return m;
  }, [ots]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-slate-500">
          Tablero operativo · OT
        </p>
        <p className="text-[0.6rem] text-slate-600">{ots.length} en vista</p>
      </div>

      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden px-2 pb-2 pt-2">
        {KANBAN_LANE_IDS.map((laneId) => {
          const list = byLane[laneId] || [];
          return (
            <section
              key={laneId}
              className="flex w-[168px] shrink-0 flex-col rounded-2xl border border-white/[0.07] bg-black/25 min-[420px]:w-[188px]"
            >
              <div className="shrink-0 border-b border-white/[0.06] px-2 py-2">
                <h2 className="text-[0.62rem] font-black uppercase tracking-wide text-slate-300">
                  {LANE_LABEL[laneId]}
                </h2>
                <p className="text-[0.55rem] tabular-nums text-slate-600">{list.length}</p>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-1.5 py-2">
                {list.map((ot) => (
                  <OtCard
                    key={String(ot.id)}
                    ot={ot}
                    active={String(ot.id) === String(selectedId)}
                    onSelect={onSelectOt}
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
