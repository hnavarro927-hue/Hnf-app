import { deriveOtAlert } from './deriveOtAlert.js';

const TIPO_ACCENT = {
  clima: 'border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-400/95',
  flota: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400/95',
  comercial: 'border-violet-500/20 bg-violet-500/[0.07] text-violet-300',
  administrativo: 'border-zinc-600/50 bg-zinc-800/40 text-zinc-300',
};

function tipoClass(tipo) {
  const k = String(tipo || '')
    .trim()
    .toLowerCase();
  return TIPO_ACCENT[k] || 'border-zinc-700/80 bg-zinc-900/50 text-zinc-400';
}

export function OtCard({ ot, active, onSelect, alertaOpts }) {
  const id = String(ot?.id ?? '');
  const cliente = String(ot?.cliente ?? '').trim() || '—';
  const tipo = String(ot?.tipoServicio ?? '').trim() || '—';
  const responsable = String(ot?.responsableActual ?? ot?.tecnicoAsignado ?? '').trim() || '—';
  const alert = deriveOtAlert(ot, alertaOpts);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ot)}
      className={[
        'w-full rounded-lg border px-2 py-1.5 text-left transition-colors sm:rounded-xl sm:px-2.5 sm:py-2',
        'active:bg-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/50',
        active ? 'ring-1 ring-violet-500/50 border-violet-500/35' : '',
        tipoClass(tipo),
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[0.58rem] font-bold text-zinc-100 sm:text-[0.62rem]">{id}</span>
        <span className="max-w-[40%] truncate text-[0.52rem] font-bold uppercase tracking-wide opacity-90 sm:max-w-none sm:text-[0.58rem]">
          {tipo}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-1 text-[0.62rem] font-medium leading-tight text-zinc-200 sm:mt-1 sm:line-clamp-2 sm:text-[0.68rem]">
        {cliente}
      </p>
      <p className="mt-0.5 truncate text-[0.55rem] text-zinc-500 sm:text-[0.58rem]">{responsable}</p>
      {alert ? (
        <p
          className={[
            'mt-1 truncate rounded px-1 py-0.5 text-[0.52rem] font-semibold uppercase tracking-wide sm:text-[0.55rem]',
            alert.level === 'risk' ? 'bg-red-950/80 text-red-200 ring-1 ring-red-500/30' : '',
            alert.level === 'delay' ? 'bg-amber-950/60 text-amber-100 ring-1 ring-amber-500/25' : '',
          ].join(' ')}
          title={alert.text}
        >
          {alert.text}
        </p>
      ) : null}
    </button>
  );
}
