import { buildOtLifecycleTimeline } from './otLifecycleTimeline.js';

/**
 * Timeline compacta: solo 5 hitos; scroll interno acotado si hiciera falta.
 */
export function OtLifecycleTimeline({ ot }) {
  const steps = buildOtLifecycleTimeline(ot);

  return (
    <ol className="hnf-timeline space-y-0 px-0.5">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.id} className="relative flex gap-2.5">
            {!last ? (
              <span
                className="absolute left-[7px] top-[18px] bottom-[-4px] w-px bg-zinc-700/90"
                aria-hidden
              />
            ) : null}
            <span
              className={[
                'relative z-[1] mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
                s.hecho
                  ? 'border-emerald-500/80 bg-emerald-500/25'
                  : 'border-zinc-600 bg-zinc-900',
              ].join(' ')}
              title={s.hecho ? 'Registrado' : 'Pendiente'}
            />
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.68rem] font-semibold text-zinc-200">{s.label}</span>
                <span className="shrink-0 text-[0.6rem] tabular-nums text-zinc-500">{s.fechaCorta ?? '—'}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
